-- Migration: analyst_saved_reports + model_used column
-- Run this in Supabase SQL Editor

-- Standalone analyst reports (not linked to an opportunity)
CREATE TABLE IF NOT EXISTS analyst_saved_reports (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text        NOT NULL,
  input       jsonb       NOT NULL DEFAULT '{}',
  report      jsonb       NOT NULL,
  model_used  text,
  created_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_asr_created_by ON analyst_saved_reports (created_by, created_at DESC);

-- Add model_used to existing opportunity analyst reports table
ALTER TABLE opportunity_analyst_reports
  ADD COLUMN IF NOT EXISTS model_used text;
