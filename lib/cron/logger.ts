import { supabaseAdmin } from '@/lib/supabase/client';

export type CronLogStatus = 'success' | 'partial' | 'failed';

export interface CronLogPayload {
  run_date: string;
  started_at: string;
  completed_at?: string;
  status: CronLogStatus;
  opportunities_found: number;
  opportunities_saved: number;
  whatsapp_alerts_sent: number;
  error_message?: string | null;
  step_failed?: string | null;
  retry_count: number;
}

export async function createCronLog(payload: CronLogPayload): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('cron_job_logs')
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create cron log:', error.message);
    return '';
  }
  return data.id as string;
}

export async function updateCronLog(
  id: string,
  updates: Partial<CronLogPayload>
): Promise<void> {
  if (!id) return;
  const { error } = await supabaseAdmin
    .from('cron_job_logs')
    .update(updates)
    .eq('id', id);
  if (error) console.error('Failed to update cron log:', error.message);
}
