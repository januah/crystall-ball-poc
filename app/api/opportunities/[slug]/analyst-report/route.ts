import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/client';
import { callAnalystAI } from '@/lib/analyst/ai';

export const maxDuration = 300;

// GET /api/opportunities/[slug]/analyst-report
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    getSessionUser(req);

    const { data, error } = await supabaseAdmin
      .from('opportunity_analyst_reports')
      .select('report, created_at, created_by, model_used')
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

    const { report, model_used } = await callAnalystAI({
      opportunity_title:       title,
      opportunity_description: description,
      amast_verticals:         verticals ?? ['AI', 'SaaS'],
      sea_region:              'Southeast Asia',
    });

    const { error } = await supabaseAdmin
      .from('opportunity_analyst_reports')
      .upsert(
        {
          opportunity_slug: params.slug,
          report,
          model_used,
          created_by:  user.id,
          created_at:  new Date().toISOString(),
        },
        { onConflict: 'opportunity_slug' }
      );

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: report, model_used });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
