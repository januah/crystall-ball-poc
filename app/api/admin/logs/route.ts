import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/client';

const PAGE_SIZE = 20;

// GET /api/admin/logs?page=1&pageSize=20&status=success&date=2026-04-06
export async function GET(req: NextRequest) {
  try {
    getSessionUser(req);

    const { searchParams } = req.nextUrl;
    const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1', 10));
    const pageSize = Math.max(1, parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE), 10));
    const status   = searchParams.get('status') ?? '';   // '' = all
    const date     = searchParams.get('date')   ?? '';   // YYYY-MM-DD or ''

    const from = (page - 1) * pageSize;
    const to   = from + pageSize - 1;

    let query = supabaseAdmin
      .from('cron_job_logs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (date)   query = query.eq('run_date', date);

    const { data, error, count } = await query;

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      data:     data ?? [],
      total:    count ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
