-- =============================================================
-- Crystal Ball — Supabase Schema Migration
-- Run this as a single transaction against your Supabase project.
-- =============================================================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- TABLE: roles
-- =============================================================
CREATE TABLE IF NOT EXISTS roles (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text        UNIQUE NOT NULL CHECK (name IN ('admin', 'analyst', 'viewer')),
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: users
-- Admin creates users manually — no Supabase Auth involved.
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
    id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         text        UNIQUE NOT NULL,
    password_hash text        NOT NULL,
    role_id       uuid        REFERENCES roles(id),
    full_name     text,
    department    text,
    avatar_url    text,
    is_active     boolean     NOT NULL DEFAULT true,
    created_by    uuid        REFERENCES users(id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz
);

-- =============================================================
-- TABLE: categories
-- =============================================================
CREATE TABLE IF NOT EXISTS categories (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text        UNIQUE NOT NULL,
    description text,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: amast_domains
-- =============================================================
CREATE TABLE IF NOT EXISTS amast_domains (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text        UNIQUE NOT NULL,
    description text,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: data_sources
-- =============================================================
CREATE TABLE IF NOT EXISTS data_sources (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text        UNIQUE NOT NULL,
    url         text,
    description text,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- TABLE: opportunities
-- =============================================================
CREATE TABLE IF NOT EXISTS opportunities (
    id                        uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
    title                     text         NOT NULL,
    slug                      text         UNIQUE NOT NULL,
    category_id               uuid         REFERENCES categories(id),
    trend_type                text         CHECK (trend_type IN ('hype', 'traction')),
    sea_competitor_exists     boolean      NOT NULL,
    sea_competitor_notes      text,
    ai_summary                text,
    sea_adoption_analysis     text,
    business_model_estimate   text,
    hype_traction_explanation text,
    market_size_estimate      text,
    score_velocity            numeric(5,2) CHECK (score_velocity BETWEEN 0 AND 100),
    score_traction            numeric(5,2) CHECK (score_traction BETWEEN 0 AND 100),
    score_sea_competition     numeric(5,2) CHECK (score_sea_competition BETWEEN 0 AND 100),
    score_amast_alignment     numeric(5,2) CHECK (score_amast_alignment BETWEEN 0 AND 100),
    score_market_size         numeric(5,2) CHECK (score_market_size BETWEEN 0 AND 100),
    score_total               numeric(5,2),
    rank_position             integer,
    first_discovered_at       timestamptz  NOT NULL DEFAULT now(),
    last_updated_at           timestamptz  NOT NULL DEFAULT now(),
    created_at                timestamptz  NOT NULL DEFAULT now()
);

-- =============================================================
-- TRIGGER: auto-compute score_total on opportunities
-- score_total = velocity*0.20 + traction*0.20 + sea_competition*0.30
--              + amast_alignment*0.15 + market_size*0.15
-- =============================================================
CREATE OR REPLACE FUNCTION compute_opportunity_score()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.score_total :=
        COALESCE(NEW.score_velocity,        0) * 0.20 +
        COALESCE(NEW.score_traction,        0) * 0.20 +
        COALESCE(NEW.score_sea_competition, 0) * 0.30 +
        COALESCE(NEW.score_amast_alignment, 0) * 0.15 +
        COALESCE(NEW.score_market_size,     0) * 0.15;
    NEW.last_updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_opportunity_score
    BEFORE INSERT OR UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION compute_opportunity_score();

-- =============================================================
-- TABLE: opportunity_trend_history
-- Append-only daily snapshot per opportunity.
-- =============================================================
CREATE TABLE IF NOT EXISTS opportunity_trend_history (
    id                    uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id        uuid         NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    run_date              date         NOT NULL,
    rank_position         integer,
    score_velocity        numeric(5,2),
    score_traction        numeric(5,2),
    score_sea_competition numeric(5,2),
    score_amast_alignment numeric(5,2),
    score_market_size     numeric(5,2),
    score_total           numeric(5,2),
    trend_type            text,
    sea_competitor_exists boolean,
    created_at            timestamptz  NOT NULL DEFAULT now(),
    UNIQUE (opportunity_id, run_date)
);

CREATE OR REPLACE FUNCTION compute_trend_history_score()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.score_total :=
        COALESCE(NEW.score_velocity,        0) * 0.20 +
        COALESCE(NEW.score_traction,        0) * 0.20 +
        COALESCE(NEW.score_sea_competition, 0) * 0.30 +
        COALESCE(NEW.score_amast_alignment, 0) * 0.15 +
        COALESCE(NEW.score_market_size,     0) * 0.15;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_trend_history_score
    BEFORE INSERT OR UPDATE ON opportunity_trend_history
    FOR EACH ROW EXECUTE FUNCTION compute_trend_history_score();

-- =============================================================
-- TABLE: opportunity_sources
-- =============================================================
CREATE TABLE IF NOT EXISTS opportunity_sources (
    id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id    uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    source_id         uuid        NOT NULL REFERENCES data_sources(id),
    source_url        text,
    contribution_note text,
    discovered_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (opportunity_id, source_id)
);

-- =============================================================
-- TABLE: opportunity_amast_alignments
-- =============================================================
CREATE TABLE IF NOT EXISTS opportunity_amast_alignments (
    id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    domain_id      uuid        NOT NULL REFERENCES amast_domains(id),
    alignment_notes text,
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (opportunity_id, domain_id)
);

-- =============================================================
-- TABLE: opportunity_curation
-- Per-user status per opportunity.
-- =============================================================
CREATE TABLE IF NOT EXISTS opportunity_curation (
    id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    user_id        uuid        NOT NULL REFERENCES users(id),
    status         text        NOT NULL DEFAULT 'unreviewed'
                               CHECK (status IN ('interested', 'rejected', 'follow_up', 'unreviewed')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (opportunity_id, user_id)
);

-- =============================================================
-- TABLE: opportunity_notes
-- Append-only versioned notes per user per opportunity.
-- =============================================================
CREATE TABLE IF NOT EXISTS opportunity_notes (
    id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    user_id        uuid        NOT NULL REFERENCES users(id),
    note_text      text        NOT NULL,
    version        integer     NOT NULL,
    is_latest      boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- INDEXES
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_opportunities_slug
    ON opportunities(slug);

CREATE INDEX IF NOT EXISTS idx_opportunities_score_total
    ON opportunities(score_total DESC);

CREATE INDEX IF NOT EXISTS idx_opportunities_rank_position
    ON opportunities(rank_position);

CREATE INDEX IF NOT EXISTS idx_trend_history_run_date
    ON opportunity_trend_history(run_date DESC);

CREATE INDEX IF NOT EXISTS idx_trend_history_opportunity_id
    ON opportunity_trend_history(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_curation_opp_user
    ON opportunity_curation(opportunity_id, user_id);

CREATE INDEX IF NOT EXISTS idx_notes_opp_user
    ON opportunity_notes(opportunity_id, user_id);

-- =============================================================
-- UPDATED_AT triggers
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_curation_updated_at
    BEFORE UPDATE ON opportunity_curation
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- SESSION VARIABLE HELPERS
-- Used by RLS policies instead of auth.uid() (custom auth, no Supabase Auth).
-- Set these before each request:
--   SELECT set_config('app.current_user_id',   '<uuid>', true);
--   SELECT set_config('app.current_user_role',  'admin',  true);
-- =============================================================
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
    LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
    $$;

CREATE OR REPLACE FUNCTION app_current_user_role() RETURNS text
    LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('app.current_user_role', true), '')
    $$;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean
    LANGUAGE sql STABLE AS $$
        SELECT app_current_user_role() = 'admin'
    $$;

CREATE OR REPLACE FUNCTION app_is_active_user() RETURNS boolean
    LANGUAGE sql STABLE AS $$
        SELECT app_current_user_id() IS NOT NULL
    $$;

-- Convenience RPC for application layer to set session context in one call.
CREATE OR REPLACE FUNCTION set_app_session(p_user_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM set_config('app.current_user_id',   p_user_id::text, true);
    PERFORM set_config('app.current_user_role',  p_role,          true);
END;
$$;

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE roles                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE amast_domains              ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources               ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities              ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_trend_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_amast_alignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_curation       ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_notes          ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------
-- roles / categories / amast_domains / data_sources
-- All active users: SELECT | Admin only: INSERT, UPDATE, DELETE
-- ---------------------------------------------------------------
CREATE POLICY roles_select ON roles
    FOR SELECT USING (app_is_active_user());
CREATE POLICY roles_insert ON roles
    FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY roles_update ON roles
    FOR UPDATE USING (app_is_admin());
CREATE POLICY roles_delete ON roles
    FOR DELETE USING (app_is_admin());

CREATE POLICY categories_select ON categories
    FOR SELECT USING (app_is_active_user());
CREATE POLICY categories_insert ON categories
    FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY categories_update ON categories
    FOR UPDATE USING (app_is_admin());
CREATE POLICY categories_delete ON categories
    FOR DELETE USING (app_is_admin());

CREATE POLICY amast_domains_select ON amast_domains
    FOR SELECT USING (app_is_active_user());
CREATE POLICY amast_domains_insert ON amast_domains
    FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY amast_domains_update ON amast_domains
    FOR UPDATE USING (app_is_admin());
CREATE POLICY amast_domains_delete ON amast_domains
    FOR DELETE USING (app_is_admin());

CREATE POLICY data_sources_select ON data_sources
    FOR SELECT USING (app_is_active_user());
CREATE POLICY data_sources_insert ON data_sources
    FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY data_sources_update ON data_sources
    FOR UPDATE USING (app_is_admin());
CREATE POLICY data_sources_delete ON data_sources
    FOR DELETE USING (app_is_admin());

-- ---------------------------------------------------------------
-- users
-- Admin: SELECT/INSERT/UPDATE all | Others: SELECT own row only
-- No DELETE (soft-delete via is_active)
-- ---------------------------------------------------------------
CREATE POLICY users_select_admin ON users
    FOR SELECT USING (app_is_admin());
CREATE POLICY users_select_self ON users
    FOR SELECT USING (id = app_current_user_id());
CREATE POLICY users_insert ON users
    FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY users_update ON users
    FOR UPDATE USING (app_is_admin());

-- ---------------------------------------------------------------
-- opportunities / trend_history / sources / alignments
-- All active users: SELECT | Admin only: INSERT, UPDATE, DELETE
-- ---------------------------------------------------------------
CREATE POLICY opportunities_select ON opportunities
    FOR SELECT USING (app_is_active_user());
CREATE POLICY opportunities_insert ON opportunities
    FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY opportunities_update ON opportunities
    FOR UPDATE USING (app_is_admin());
CREATE POLICY opportunities_delete ON opportunities
    FOR DELETE USING (app_is_admin());

CREATE POLICY trend_history_select ON opportunity_trend_history
    FOR SELECT USING (app_is_active_user());
CREATE POLICY trend_history_insert ON opportunity_trend_history
    FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY trend_history_update ON opportunity_trend_history
    FOR UPDATE USING (app_is_admin());
CREATE POLICY trend_history_delete ON opportunity_trend_history
    FOR DELETE USING (app_is_admin());

CREATE POLICY opp_sources_select ON opportunity_sources
    FOR SELECT USING (app_is_active_user());
CREATE POLICY opp_sources_insert ON opportunity_sources
    FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY opp_sources_update ON opportunity_sources
    FOR UPDATE USING (app_is_admin());
CREATE POLICY opp_sources_delete ON opportunity_sources
    FOR DELETE USING (app_is_admin());

CREATE POLICY opp_alignments_select ON opportunity_amast_alignments
    FOR SELECT USING (app_is_active_user());
CREATE POLICY opp_alignments_insert ON opportunity_amast_alignments
    FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY opp_alignments_update ON opportunity_amast_alignments
    FOR UPDATE USING (app_is_admin());
CREATE POLICY opp_alignments_delete ON opportunity_amast_alignments
    FOR DELETE USING (app_is_admin());

-- ---------------------------------------------------------------
-- opportunity_curation
-- Users: SELECT/INSERT/UPDATE own rows | Admin: SELECT all
-- ---------------------------------------------------------------
CREATE POLICY curation_select_own ON opportunity_curation
    FOR SELECT USING (user_id = app_current_user_id());
CREATE POLICY curation_select_admin ON opportunity_curation
    FOR SELECT USING (app_is_admin());
CREATE POLICY curation_insert_own ON opportunity_curation
    FOR INSERT WITH CHECK (user_id = app_current_user_id());
CREATE POLICY curation_update_own ON opportunity_curation
    FOR UPDATE USING (user_id = app_current_user_id());

-- ---------------------------------------------------------------
-- opportunity_notes
-- Append-only: SELECT own + INSERT own | Admin: SELECT all
-- No UPDATE or DELETE policies (intentionally omitted)
-- ---------------------------------------------------------------
CREATE POLICY notes_select_own ON opportunity_notes
    FOR SELECT USING (user_id = app_current_user_id());
CREATE POLICY notes_select_admin ON opportunity_notes
    FOR SELECT USING (app_is_admin());
CREATE POLICY notes_insert_own ON opportunity_notes
    FOR INSERT WITH CHECK (user_id = app_current_user_id());

COMMIT;
