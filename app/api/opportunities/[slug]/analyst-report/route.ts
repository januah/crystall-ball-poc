import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/client';
import { ANALYST_SYSTEM_PROMPT, buildUserMessage } from '@/lib/analyst/prompt';
import type { AnalystReport, AnalystInput } from '@/lib/analyst/types';

export const maxDuration = 120;

const ANALYST_MODEL = process.env.ANALYST_AI_MODEL ?? 'anthropic/claude-sonnet-4-5';

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
  if (typeof content !== 'string') throw new Error('Unexpected AI response shape');

  const cleaned = content.trim()
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as AnalystReport;
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1]) as AnalystReport;
    throw new Error(`AI returned non-JSON: ${cleaned.slice(0, 400)}`);
  }
}

// GET /api/opportunities/[slug]/analyst-report
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    getSessionUser(req);

    const { data, error } = await supabaseAdmin
      .from('opportunity_analyst_reports')
      .select('report, created_at, created_by')
      .eq('opportunity_slug', params.slug)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/opportunities/[slug]/analyst-report
// Body: { title, description, verticals }
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const user = getSessionUser(req);
    if (user.role !== 'admin' && user.role !== 'analyst') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { title, description, verticals } = await req.json();

    const report = await callAnalystAI({
      opportunity_title:       title,
      opportunity_description: description,
      amast_verticals:         verticals ?? ['AI', 'SaaS'],
      sea_region:              'Southeast Asia',
    });

    // Upsert — one report per opportunity slug
    const { error } = await supabaseAdmin
      .from('opportunity_analyst_reports')
      .upsert(
        {
          opportunity_slug: params.slug,
          report,
          created_by:       user.id,
          created_at:       new Date().toISOString(),
        },
        { onConflict: 'opportunity_slug' }
      );

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
