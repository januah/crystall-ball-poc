// Analyst AI caller — dynamically fetches the current free model list from
// OpenRouter, caches it for 1 hour, and tries models in sequence until one
// succeeds. Falls back to a hardcoded seed list if the API is unreachable.
// If ALL OpenRouter free models fail, falls back to Anthropic SDK (Claude Haiku).

import Anthropic from '@anthropic-ai/sdk';
import { ANALYST_SYSTEM_PROMPT, buildUserMessage } from './prompt';
import type { AnalystInput, AnalystReport } from './types';

// ─── Free model cache ────────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_CONTEXT   = 8_000;          // exclude tiny models that can't follow the schema

const SEED_MODELS = [
  'google/gemma-3-27b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'stepfun/step-3.5-flash:free',
  'qwen/qwen3.6-plus:free',
  'minimax/minimax-m2.5:free',
  'arcee-ai/trinity-large-preview:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openrouter/free',
];

let _cache: { models: string[]; fetchedAt: number } | null = null;

async function getFreeModels(): Promise<string[]> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) return _cache.models;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    });
    if (!res.ok) throw new Error(`Models API ${res.status}`);

    const { data } = await res.json() as {
      data: { id: string; context_length?: number; pricing?: { prompt: string; completion: string } }[];
    };

    const free = data
      .filter((m) => {
        const isFree = m.id.endsWith(':free') ||
          (m.pricing?.prompt === '0' && m.pricing?.completion === '0');
        const hasContext = !m.context_length || m.context_length >= MIN_CONTEXT;
        return isFree && hasContext;
      })
      .map((m) => m.id);

    if (free.length === 0) throw new Error('No eligible free models returned');

    const pinned = [
      process.env.ANALYST_PRIMARY_MODEL,
      process.env.ANALYST_FALLBACK_MODEL,
    ].filter(Boolean) as string[];

    const rest = free.filter((id) => !pinned.includes(id));
    const models = [...pinned, ...rest];

    _cache = { models, fetchedAt: Date.now() };
    console.log(`[analyst] Refreshed free model list: ${models.join(', ')}`);
    return models;
  } catch (err) {
    console.warn(`[analyst] Could not fetch model list — using seed list. Reason: ${err}`);
    return [
      ...(process.env.ANALYST_PRIMARY_MODEL  ? [process.env.ANALYST_PRIMARY_MODEL]  : []),
      ...(process.env.ANALYST_FALLBACK_MODEL ? [process.env.ANALYST_FALLBACK_MODEL] : []),
      ...SEED_MODELS,
    ];
  }
}

export async function refreshFreeModels(): Promise<string[]> {
  _cache = null;
  return getFreeModels();
}

// ─── OpenRouter caller ───────────────────────────────────────────────

// Thrown when a model should be skipped and the next one tried
class SkipModelError extends Error {
  constructor(msg: string) { super(msg); this.name = 'SkipModelError'; }
}

async function callOpenRouter(messages: object[], model: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://crystal-ball.vercel.app',
      'X-Title':      'Crystal Ball Analyst',
    },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 4000 }),
  });

  // These all mean "skip to next model"
  if ([402, 404, 429, 503].includes(res.status)) {
    const body = await res.text().catch(() => '');
    throw new SkipModelError(`${model} HTTP ${res.status}: ${body.slice(0, 120)}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new SkipModelError(`${model} returned unexpected response shape`);
  }
  return content;
}

// ─── JSON parser ─────────────────────────────────────────────────────

function parseReport(raw: string, model: string): AnalystReport {
  const cleaned = raw.trim()
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  // Try full parse first
  try { return JSON.parse(cleaned) as AnalystReport; } catch { /* continue */ }

  // Try extracting the first JSON object
  const match = cleaned.match(/(\{[\s\S]*\})/);
  if (match) {
    try { return JSON.parse(match[1]) as AnalystReport; } catch { /* continue */ }
  }

  // Model produced non-JSON — skip it and let the next one try
  throw new SkipModelError(`${model} returned non-JSON content: ${cleaned.slice(0, 200)}`);
}

// ─── Claude SDK fallback ─────────────────────────────────────────────

const CLAUDE_FALLBACK_MODEL = 'claude-haiku-4-5-20251001';

async function callClaudeFallback(input: AnalystInput): Promise<AnalystResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured — Claude fallback unavailable.');

  console.log(`[analyst] Calling Anthropic SDK — model: ${CLAUDE_FALLBACK_MODEL}`);

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
      model:      CLAUDE_FALLBACK_MODEL,
      max_tokens: 8192,
      system:     ANALYST_SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: buildUserMessage(input) }],
    });
    console.log(`[analyst] Anthropic SDK response received. stop_reason: ${response.stop_reason}, content blocks: ${response.content.length}`);
    if (response.stop_reason === 'max_tokens') {
      throw new Error(`Response truncated (max_tokens hit). Raw length so far: ${response.content.find(b => b.type === 'text') ? (response.content.find(b => b.type === 'text') as any).text.length : 0} chars. Increase max_tokens.`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[analyst] Anthropic SDK call failed: ${msg}`);
    throw err;
  }

  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    console.error(`[analyst] No text block in response. Content:`, JSON.stringify(response.content));
    throw new Error('Claude returned no text content.');
  }

  console.log(`[analyst] Raw response length: ${block.text.length} chars`);
  console.log(`[analyst] Raw response preview: ${block.text.slice(0, 300)}`);

  const report = parseReport(block.text, CLAUDE_FALLBACK_MODEL);
  console.log(`[analyst] JSON parsed successfully.`);
  return { report, model_used: `anthropic/${CLAUDE_FALLBACK_MODEL}` };
}

// ─── Main export ─────────────────────────────────────────────────────

export interface AnalystResult {
  report:     AnalystReport;
  model_used: string;
}

export async function callAnalystAI(input: AnalystInput): Promise<AnalystResult> {
  // OpenRouter free-model chain — temporarily disabled; using Anthropic SDK directly.
  // Re-enable by uncommenting the block below and removing the direct fallback call.
  //
  // const messages = [
  //   { role: 'system', content: ANALYST_SYSTEM_PROMPT },
  //   { role: 'user',   content: buildUserMessage(input) },
  // ];
  // const models = await getFreeModels();
  // for (const model of models) {
  //   try {
  //     console.log(`[analyst] Trying: ${model}`);
  //     const content = await callOpenRouter(messages, model);
  //     const report  = parseReport(content, model);
  //     console.log(`[analyst] Success: ${model}`);
  //     return { report, model_used: model };
  //   } catch (err) {
  //     if (err instanceof SkipModelError) {
  //       console.warn(`[analyst] Skipping — ${err.message}`);
  //       continue;
  //     }
  //     throw err;
  //   }
  // }

  return callClaudeFallback(input);
}
