// Analyst AI caller — dynamically fetches the current free model list from
// OpenRouter, caches it for 1 hour, and tries models in sequence until one
// succeeds. Falls back to a hardcoded seed list if the API is unreachable.

import { ANALYST_SYSTEM_PROMPT, buildUserMessage } from './prompt';
import type { AnalystInput, AnalystReport } from './types';

// ─── Free model cache ────────────────────────────────────────────────
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const SEED_MODELS = [
  'google/gemma-3-27b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'stepfun/step-3.5-flash:free',
  'qwen/qwen3.6-plus:free',
  'minimax/minimax-m2.5:free',
  'arcee-ai/trinity-large-preview:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'liquid/lfm-2.5-1.2b-thinking:free',
  'openrouter/free',
];

let _cache: { models: string[]; fetchedAt: number } | null = null;

async function getFreeModels(): Promise<string[]> {
  // Return cache if still fresh
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.models;
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      // Next.js cache: revalidate every hour server-side too
      next: { revalidate: 3600 },
    } as RequestInit);

    if (!res.ok) throw new Error(`Models API ${res.status}`);

    const { data } = await res.json() as { data: { id: string; pricing?: { prompt: string; completion: string } }[] };

    // A model is free if its ID ends with :free OR both prompt+completion cost 0
    const free = data
      .filter((m) =>
        m.id.endsWith(':free') ||
        (m.pricing?.prompt === '0' && m.pricing?.completion === '0')
      )
      .map((m) => m.id);

    if (free.length === 0) throw new Error('No free models returned');

    // Env-var overrides stay at the front
    const pinned = [
      process.env.ANALYST_PRIMARY_MODEL,
      process.env.ANALYST_FALLBACK_MODEL,
    ].filter(Boolean) as string[];

    const rest = free.filter((id) => !pinned.includes(id));
    const models = [...pinned, ...rest];

    _cache = { models, fetchedAt: Date.now() };
    console.log(`[analyst] Refreshed free model list (${models.length} models)`);
    return models;
  } catch (err) {
    console.warn(`[analyst] Could not fetch model list — using seed list. Reason: ${err}`);
    return SEED_MODELS;
  }
}

// Expose for the refresh API endpoint
export async function refreshFreeModels(): Promise<string[]> {
  _cache = null;
  return getFreeModels();
}

// ─── OpenRouter caller ───────────────────────────────────────────────
class SkipModelError extends Error {}

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

  if (res.status === 429 || res.status === 503 || res.status === 404 || res.status === 402) {
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
    throw new Error(`Unexpected OpenRouter response: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return content;
}

// ─── JSON parser ─────────────────────────────────────────────────────
function parseReport(raw: string): AnalystReport {
  const cleaned = raw.trim()
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as AnalystReport;
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1]) as AnalystReport;
    throw new Error(`AI returned non-JSON content: ${cleaned.slice(0, 400)}`);
  }
}

// ─── Main export ─────────────────────────────────────────────────────
export async function callAnalystAI(input: AnalystInput): Promise<AnalystReport> {
  const messages = [
    { role: 'system', content: ANALYST_SYSTEM_PROMPT },
    { role: 'user',   content: buildUserMessage(input) },
  ];

  const models = await getFreeModels();

  for (const model of models) {
    try {
      console.log(`[analyst] Trying model: ${model}`);
      const content = await callOpenRouter(messages, model);
      return parseReport(content);
    } catch (err) {
      if (err instanceof SkipModelError) {
        console.warn(`[analyst] Skipping — ${err.message}`);
        continue;
      }
      throw err;
    }
  }

  throw new Error('All free models are currently unavailable. Please try again in a few minutes.');
}
