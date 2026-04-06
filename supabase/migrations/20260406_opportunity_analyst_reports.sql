-- Migration: opportunity_analyst_reports
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS opportunity_analyst_reports (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_slug  text        NOT NULL UNIQUE,
  report            jsonb       NOT NULL,
  created_by        uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oar_slug ON opportunity_analyst_reports (opportunity_slug);
