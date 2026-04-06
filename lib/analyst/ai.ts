// Analyst AI caller — tries a chain of free models in sequence.
// If a model is rate-limited (429/503), unavailable (404), or requires
// credits (402), it moves to the next model automatically.

import { ANALYST_SYSTEM_PROMPT, buildUserMessage } from './prompt';
import type { AnalystInput, AnalystReport } from './types';

// All free models on OpenRouter, tried in order.
// Override the first two via env vars; the rest are hardcoded fallbacks.
const MODEL_CHAIN: string[] = [
  process.env.ANALYST_PRIMARY_MODEL  ?? 'google/gemma-3-27b-it:free',
  process.env.ANALYST_FALLBACK_MODEL ?? 'nvidia/nemotron-3-super-120b-a12b:free',
  'stepfun/step-3.5-flash:free',
  'qwen/qwen3.6-plus:free',
  'minimax/minimax-m2.5:free',
];

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
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens:  4000,
    }),
  });

  // Any of these mean "try the next model"
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

function parseReport(raw: string): AnalystReport {
  const cleaned = raw
    .trim()
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

export async function callAnalystAI(input: AnalystInput): Promise<AnalystReport> {
  const messages = [
    { role: 'system', content: ANALYST_SYSTEM_PROMPT },
    { role: 'user',   content: buildUserMessage(input) },
  ];

  for (const model of MODEL_CHAIN) {
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

  throw new Error('All free models are currently rate-limited. Please try again in a few minutes.');
}
