-- Crystal Ball: cron_job_logs table
-- Tracks every cron run for observability and debugging.

CREATE TABLE IF NOT EXISTS cron_job_logs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date              date        NOT NULL,
  started_at            timestamptz NOT NULL,
  completed_at          timestamptz,
  status                text        NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  opportunities_found   integer     NOT NULL DEFAULT 0,
  opportunities_saved   integer     NOT NULL DEFAULT 0,
  whatsapp_alerts_sent  integer     NOT NULL DEFAULT 0,
  error_message         text,
  step_failed           text,
  retry_count           integer     NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_job_logs_run_date ON cron_job_logs (run_date DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_status    ON cron_job_logs (status);
