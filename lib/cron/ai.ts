// OpenRouter AI calls — primary model with automatic fallback.
// callAI(prompt, step) is the only export needed by the pipeline.

const PRIMARY_MODEL =
  process.env.PRIMARY_AI_MODEL ?? 'google/gemma-3-27b-it:free';
const FALLBACK_MODEL =
  process.env.FALLBACK_AI_MODEL ?? 'mistralai/mistral-7b-instruct:free';

class RateLimitError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'RateLimitError';
  }
}

async function callOpenRouter(prompt: string, model: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://crystal-ball.vercel.app',
      'X-Title': 'Crystal Ball Cron',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  });

  if (res.status === 429 || res.status === 503) {
    throw new RateLimitError(`Model ${model} returned HTTP ${res.status}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error(
      `Unexpected OpenRouter response: ${JSON.stringify(json).slice(0, 200)}`
    );
  }
  return content;
}

function extractJSON(raw: string, step: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract first JSON object or array from the response
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch { /* fall through */ }
    }
    throw new Error(
      `[${step}] AI response is not valid JSON.\nFirst 400 chars: ${cleaned.slice(0, 400)}`
    );
  }
}

export async function callAI(prompt: string, step: string): Promise<unknown> {
  let content: string;
  try {
    content = await callOpenRouter(prompt, PRIMARY_MODEL);
  } catch (err) {
    if (err instanceof RateLimitError) {
      console.warn(`[${step}] Primary model rate-limited, switching to fallback`);
      content = await callOpenRouter(prompt, FALLBACK_MODEL);
    } else {
      throw err;
    }
  }
  return extractJSON(content, step);
}
