import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase/client';

// Schedule mirrors vercel.json — used for next-run calculation
const CRON_SCHEDULE = '0 23 * * *'; // 23:00 UTC daily

function nextRunUTC(cronExpr: string): string {
  const parts = cronExpr.split(' ');
  const minute = parseInt(parts[0], 10);
  const hour   = parseInt(parts[1], 10);

  const now = new Date();
  const candidate = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    hour, minute, 0, 0
  ));
  if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate.toISOString();
}

// GET /api/admin/cron-config
export async function GET(req: NextRequest) {
  try {
    getSessionUser(req);

    let isPaused = false;
    try {
      const { data } = await supabaseAdmin
        .from('cron_config')
        .select('is_paused')
        .eq('id', 1)
        .maybeSingle();
      isPaused = data?.is_paused ?? false;
    } catch {
      // table not yet created — treat as enabled
    }

    return NextResponse.json({
      success: true,
      data: {
        is_paused: isPaused,
        schedule: CRON_SCHEDULE,
        next_run: isPaused ? null : nextRunUTC(CRON_SCHEDULE),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/admin/cron-config  { is_paused: boolean }
export async function PATCH(req: NextRequest) {
  try {
    getSessionUser(req);
    const { is_paused } = await req.json();

    const { error } = await supabaseAdmin
      .from('cron_config')
      .upsert({ id: 1, is_paused }, { onConflict: 'id' });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data: { is_paused } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
