// Analyst AI caller — primary free model with automatic fallback.
// Both analyst API routes import callAnalystAI from here.

import { ANALYST_SYSTEM_PROMPT, buildUserMessage } from './prompt';
import type { AnalystInput, AnalystReport } from './types';

const PRIMARY_MODEL =
  process.env.ANALYST_PRIMARY_MODEL ?? 'google/gemma-3-27b-it:free';
const FALLBACK_MODEL =
  process.env.ANALYST_FALLBACK_MODEL ?? 'mistralai/mistral-7b-instruct:free';

class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'RateLimitError';
  }
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
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens:  4000,
    }),
  });

  if (res.status === 429 || res.status === 503) {
    throw new RateLimitError(`Model ${model} returned HTTP ${res.status}`);
  }
  if (res.status === 402) {
    throw new RateLimitError(`Model ${model} requires paid credits (HTTP 402) — switching to fallback`);
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

  let content: string;
  try {
    content = await callOpenRouter(messages, PRIMARY_MODEL);
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn(`[analyst] Primary model unavailable (${err.message}), switching to fallback`);
      content = await callOpenRouter(messages, FALLBACK_MODEL);
    } else {
      throw err;
    }
  }

  return parseReport(content);
}
