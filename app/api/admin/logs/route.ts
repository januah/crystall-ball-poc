import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/client';

// GET /api/admin/logs — admin only
export async function GET(req: NextRequest) {
  try {
    getSessionUser(req);

    const { data, error } = await supabaseAdmin
      .from('cron_job_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
