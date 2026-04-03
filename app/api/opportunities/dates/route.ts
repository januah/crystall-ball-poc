import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/client';

// GET /api/opportunities/dates — returns available run dates (desc)
export async function GET(req: NextRequest) {
  try {
    getSessionUser(req); // auth check only

    const { data, error } = await supabaseAdmin
      .from('opportunity_trend_history')
      .select('run_date')
      .order('run_date', { ascending: false });

    if (error) throw new Error(error.message);

    // Deduplicate
    const dates = [...new Set((data ?? []).map((r: any) => r.run_date as string))];
    return NextResponse.json({ success: true, data: dates });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
