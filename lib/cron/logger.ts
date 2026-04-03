import { supabaseAdmin } from '@/lib/supabase/client';

export type CronLogStatus = 'success' | 'partial' | 'failed';

export interface StepLog {
  ts: string;
  level: 'info' | 'warn' | 'error';
  step: string;
  message: string;
}

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
  step_logs?: StepLog[];
  retry_count: number;
}

export class PipelineLogger {
  private logs: StepLog[] = [];

  info(step: string, message: string): void {
    this.push('info', step, message);
  }

  warn(step: string, message: string): void {
    this.push('warn', step, message);
  }

  error(step: string, message: string): void {
    this.push('error', step, message);
  }

  flush(): StepLog[] {
    return [...this.logs];
  }

  private push(level: StepLog['level'], step: string, message: string): void {
    const entry: StepLog = { ts: new Date().toISOString(), level, step, message };
    this.logs.push(entry);
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`[pipeline][${step}] ${message}`);
  }
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
