import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { runPipeline } from '@/lib/cron/pipeline';
import { createCronLog, updateCronLog, PipelineLogger } from '@/lib/cron/logger';

export const maxDuration = 300;

// POST /api/cron/trigger — manual pipeline trigger, admin only
export async function POST(req: NextRequest) {
  try {
    getSessionUser(req); // admin enforced by middleware

    const startedAt = new Date().toISOString();
    const runDate = startedAt.slice(0, 10);

    const logId = await createCronLog({
      run_date: runDate,
      started_at: startedAt,
      status: 'running',
      opportunities_found: 0,
      opportunities_saved: 0,
      whatsapp_alerts_sent: 0,
      retry_count: 0,
    });

    const logger = new PipelineLogger();

    let result;
    try {
      result = await runPipeline(logger);
    } catch (pipelineErr) {
      const message = pipelineErr instanceof Error ? pipelineErr.message : String(pipelineErr);
      await updateCronLog(logId, {
        completed_at: new Date().toISOString(),
        status: 'failed',
        error_message: message,
        step_logs: logger.flush(),
      });
      throw pipelineErr;
    }

    const status =
      result.errors.length > 0 && result.opportunities_saved < result.opportunities_found
        ? 'partial'
        : 'success';

    await updateCronLog(logId, {
      completed_at: new Date().toISOString(),
      status,
      opportunities_found: result.opportunities_found,
      opportunities_saved: result.opportunities_saved,
      whatsapp_alerts_sent: result.whatsapp_alerts_sent,
      error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
      step_logs: logger.flush(),
    });

    return NextResponse.json({ success: true, status, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ success: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
