import { NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/lib/cron/pipeline';
import { createCronLog, updateCronLog } from '@/lib/cron/logger';
import { sendFailureAlert } from '@/lib/cron/whatsapp';

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

  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt] ?? 120_000;
      console.log(`[cron] Retry ${attempt}/${MAX_RETRIES - 1} — waiting ${delay}ms`);
      await updateCronLog(logId, { retry_count: attempt });
      await new Promise<void>((r) => setTimeout(r, delay));
    }

    try {
      const result = await runPipeline();

      const status: 'success' | 'partial' =
        result.errors.length > 0 &&
        result.opportunities_saved < result.opportunities_found
          ? 'partial'
          : 'success';

      await updateCronLog(logId, {
        completed_at: new Date().toISOString(),
        status,
        opportunities_found: result.opportunities_found,
        opportunities_saved: result.opportunities_saved,
        whatsapp_alerts_sent: result.whatsapp_alerts_sent,
        error_message:
          result.errors.length > 0 ? result.errors.join('; ') : null,
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
      console.error(`[cron] Attempt ${attempt + 1} failed:`, lastError);
    }
  }

  // All retries exhausted
  await updateCronLog(logId, {
    completed_at: new Date().toISOString(),
    status: 'failed',
    error_message: lastError,
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
