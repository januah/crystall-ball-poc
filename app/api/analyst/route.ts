import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { ANALYST_SYSTEM_PROMPT, buildUserMessage } from '@/lib/analyst/prompt';
import type { AnalystInput, AnalystReport } from '@/lib/analyst/types';

export const maxDuration = 120;

const ANALYST_MODEL =
  process.env.ANALYST_AI_MODEL ?? 'anthropic/claude-sonnet-4-5';

async function callAnalystAI(input: AnalystInput): Promise<AnalystReport> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'https://crystal-ball.vercel.app',
      'X-Title': 'Crystal Ball Analyst',
    },
    body: JSON.stringify({
      model: ANALYST_MODEL,
      messages: [
        { role: 'system', content: ANALYST_SYSTEM_PROMPT },
        { role: 'user',   content: buildUserMessage(input) },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Unexpected AI response shape');
  }

  // Strip markdown code fences if model wraps the JSON
  const cleaned = content
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

// POST /api/analyst
export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    if (user.role !== 'admin' && user.role !== 'analyst') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json() as AnalystInput;

    if (!body.opportunity_title?.trim()) {
      return NextResponse.json({ success: false, error: 'opportunity_title is required' }, { status: 400 });
    }
    if (!body.opportunity_description?.trim()) {
      return NextResponse.json({ success: false, error: 'opportunity_description is required' }, { status: 400 });
    }
    if (!Array.isArray(body.amast_verticals) || body.amast_verticals.length === 0) {
      return NextResponse.json({ success: false, error: 'amast_verticals must be a non-empty array' }, { status: 400 });
    }

    const report = await callAnalystAI(body);

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
