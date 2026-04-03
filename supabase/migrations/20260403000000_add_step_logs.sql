-- Add step_logs JSONB column to cron_job_logs for per-step pipeline logging
ALTER TABLE cron_job_logs ADD COLUMN IF NOT EXISTS step_logs JSONB DEFAULT '[]'::jsonb;
