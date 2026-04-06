import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/client';

// GET /api/analyst/saved — list saved reports for the current user
export async function GET(req: NextRequest) {
  try {
    const user = getSessionUser(req);

    const { data, error } = await supabaseAdmin
      .from('analyst_saved_reports')
      .select('id, title, model_used, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/analyst/saved — save a new report
export async function POST(req: NextRequest) {
  try {
    const user = getSessionUser(req);
    const { title, input, report, model_used } = await req.json();

    if (!title || !report) {
      return NextResponse.json({ success: false, error: 'title and report are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('analyst_saved_reports')
      .insert({
        title,
        input:      input ?? {},
        report,
        model_used: model_used ?? null,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: { id: data.id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET /api/analyst/saved/[id] is handled in its own route file
