import { NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/lib/cron/pipeline';
import { createCronLog, updateCronLog, PipelineLogger } from '@/lib/cron/logger';
import { sendFailureAlert } from '@/lib/cron/whatsapp';
import { supabaseAdmin } from '@/lib/supabase/client';

// Vercel Pro plan: 300s max duration
export const maxDuration = 300;

const MAX_RETRIES = 3;
// Practical retry delays within the 300s window (not the 5-min spec,
// which would exceed the serverless timeout — retries across days handle that)
const RETRY_DELAYS_MS = [0, 60_000, 120_000];

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${cronSecret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if cron is paused
  try {
    const { data: config } = await supabaseAdmin
      .from('cron_config')
      .select('is_paused')
      .eq('id', 1)
      .maybeSingle();
    if (config?.is_paused) {
      console.log('[cron] Skipped — cron is paused.');
      return NextResponse.json({ success: true, message: 'Cron is paused — skipped.' });
    }
  } catch {
    // cron_config table not yet created — proceed normally
  }

  const startedAt = new Date().toISOString();
  const runDate = startedAt.slice(0, 10);

  const logId = await createCronLog({
    run_date: runDate,
    started_at: startedAt,
    status: 'failed',
    opportunities_found: 0,
    opportunities_saved: 0,
    whatsapp_alerts_sent: 0,
    retry_count: 0,
  });

  const logger = new PipelineLogger();
  let lastError = '';
  let stepFailed: string | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt] ?? 120_000;
      logger.info('cron', `Retry ${attempt}/${MAX_RETRIES - 1} — waiting ${delay}ms`);
      await updateCronLog(logId, { retry_count: attempt });
      await new Promise<void>((r) => setTimeout(r, delay));
    }

    try {
      logger.info('cron', `Attempt ${attempt + 1} started`);
      const result = await runPipeline(logger);

      const status: 'success' | 'partial' =
        result.errors.length > 0 &&
        result.opportunities_saved < result.opportunities_found
          ? 'partial'
          : 'success';

      logger.info('cron', `Completed with status: ${status}`);

      await updateCronLog(logId, {
        completed_at: new Date().toISOString(),
        status,
        opportunities_found: result.opportunities_found,
        opportunities_saved: result.opportunities_saved,
        whatsapp_alerts_sent: result.whatsapp_alerts_sent,
        error_message:
          result.errors.length > 0 ? result.errors.join('; ') : null,
        step_failed: null,
        step_logs: logger.flush(),
        retry_count: attempt,
      });

      return NextResponse.json({
        success: true,
        status,
        opportunities_found: result.opportunities_found,
        opportunities_saved: result.opportunities_saved,
        whatsapp_alerts_sent: result.whatsapp_alerts_sent,
        errors: result.errors,
        attempt,
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      stepFailed = err instanceof Error && 'step' in err ? String((err as any).step) : null;
      logger.error('cron', `Attempt ${attempt + 1} failed: ${lastError}`);
    }
  }

  // All retries exhausted
  logger.error('cron', `All ${MAX_RETRIES} attempts failed. Last error: ${lastError}`);

  await updateCronLog(logId, {
    completed_at: new Date().toISOString(),
    status: 'failed',
    error_message: lastError,
    step_failed: stepFailed,
    step_logs: logger.flush(),
    retry_count: MAX_RETRIES,
  });

  try {
    await sendFailureAlert(lastError);
  } catch (alertErr) {
    console.error('[cron] Failed to send failure WhatsApp alert:', alertErr);
  }

  return NextResponse.json(
    { success: false, error: lastError },
    { status: 500 }
  );
}
