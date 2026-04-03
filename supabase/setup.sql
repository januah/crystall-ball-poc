-- =============================================================
-- Crystal Ball — Full Database Setup
-- Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor).
-- Safe to run on a fresh project. All statements are idempotent.
-- After running, call POST /api/auth/bootstrap to create the
-- first admin user.
-- =============================================================

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- TABLES
-- =============================================================

CREATE TABLE IF NOT EXISTS roles (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text        UNIQUE NOT NULL CHECK (name IN ('admin', 'analyst', 'viewer')),
    description text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS categories (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text        UNIQUE NOT NULL,
    description text,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS amast_domains (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text        UNIQUE NOT NULL,
    description text,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_sources (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        text        UNIQUE NOT NULL,
    url         text,
    description text,
    is_active   boolean     NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS opportunity_sources (
    id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id    uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    source_id         uuid        NOT NULL REFERENCES data_sources(id),
    source_url        text,
    contribution_note text,
    discovered_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (opportunity_id, source_id)
);

CREATE TABLE IF NOT EXISTS opportunity_amast_alignments (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id  uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    domain_id       uuid        NOT NULL REFERENCES amast_domains(id),
    alignment_notes text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (opportunity_id, domain_id)
);

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

CREATE TABLE IF NOT EXISTS opportunity_notes (
    id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    user_id        uuid        NOT NULL REFERENCES users(id),
    note_text      text        NOT NULL,
    version        integer     NOT NULL,
    is_latest      boolean     NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- Cron job run log
CREATE TABLE IF NOT EXISTS cron_job_logs (
    id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date             date         NOT NULL,
    started_at           timestamptz  NOT NULL,
    completed_at         timestamptz,
    status               text         NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    opportunities_found  integer      NOT NULL DEFAULT 0,
    opportunities_saved  integer      NOT NULL DEFAULT 0,
    whatsapp_alerts_sent integer      NOT NULL DEFAULT 0,
    error_message        text,
    step_failed          text,
    retry_count          integer      NOT NULL DEFAULT 0,
    -- Computed at query time; stored for fast retrieval
    duration_seconds     integer      GENERATED ALWAYS AS (
        CASE WHEN completed_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (completed_at - started_at))::integer
             ELSE NULL
        END
    ) STORED,
    created_at           timestamptz  NOT NULL DEFAULT now()
);

-- =============================================================
-- TRIGGERS & FUNCTIONS
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

DROP TRIGGER IF EXISTS trg_compute_opportunity_score ON opportunities;
CREATE TRIGGER trg_compute_opportunity_score
    BEFORE INSERT OR UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION compute_opportunity_score();

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

DROP TRIGGER IF EXISTS trg_compute_trend_history_score ON opportunity_trend_history;
CREATE TRIGGER trg_compute_trend_history_score
    BEFORE INSERT OR UPDATE ON opportunity_trend_history
    FOR EACH ROW EXECUTE FUNCTION compute_trend_history_score();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_curation_updated_at ON opportunity_curation;
CREATE TRIGGER trg_curation_updated_at
    BEFORE UPDATE ON opportunity_curation
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_run_date
    ON cron_job_logs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_status
    ON cron_job_logs(status);

-- =============================================================
-- SESSION VARIABLE HELPERS (custom auth — no Supabase Auth)
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

CREATE OR REPLACE FUNCTION set_app_session(p_user_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    PERFORM set_config('app.current_user_id',  p_user_id::text, true);
    PERFORM set_config('app.current_user_role', p_role,          true);
END;
$$;

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE roles                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE amast_domains                ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities                ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_trend_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_sources          ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_amast_alignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_curation         ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_logs                ENABLE ROW LEVEL SECURITY;

-- Drop all policies first (idempotent re-run safety)
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- roles / categories / amast_domains / data_sources
CREATE POLICY roles_select     ON roles FOR SELECT USING (app_is_active_user());
CREATE POLICY roles_insert     ON roles FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY roles_update     ON roles FOR UPDATE USING (app_is_admin());
CREATE POLICY roles_delete     ON roles FOR DELETE USING (app_is_admin());

CREATE POLICY categories_select ON categories FOR SELECT USING (app_is_active_user());
CREATE POLICY categories_insert ON categories FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY categories_update ON categories FOR UPDATE USING (app_is_admin());
CREATE POLICY categories_delete ON categories FOR DELETE USING (app_is_admin());

CREATE POLICY amast_domains_select ON amast_domains FOR SELECT USING (app_is_active_user());
CREATE POLICY amast_domains_insert ON amast_domains FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY amast_domains_update ON amast_domains FOR UPDATE USING (app_is_admin());
CREATE POLICY amast_domains_delete ON amast_domains FOR DELETE USING (app_is_admin());

CREATE POLICY data_sources_select ON data_sources FOR SELECT USING (app_is_active_user());
CREATE POLICY data_sources_insert ON data_sources FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY data_sources_update ON data_sources FOR UPDATE USING (app_is_admin());
CREATE POLICY data_sources_delete ON data_sources FOR DELETE USING (app_is_admin());

-- users
CREATE POLICY users_select_admin ON users FOR SELECT USING (app_is_admin());
CREATE POLICY users_select_self  ON users FOR SELECT USING (id = app_current_user_id());
CREATE POLICY users_insert       ON users FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY users_update       ON users FOR UPDATE USING (app_is_admin());

-- opportunities / trend_history / sources / alignments
CREATE POLICY opportunities_select ON opportunities FOR SELECT USING (app_is_active_user());
CREATE POLICY opportunities_insert ON opportunities FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY opportunities_update ON opportunities FOR UPDATE USING (app_is_admin());
CREATE POLICY opportunities_delete ON opportunities FOR DELETE USING (app_is_admin());

CREATE POLICY trend_history_select ON opportunity_trend_history FOR SELECT USING (app_is_active_user());
CREATE POLICY trend_history_insert ON opportunity_trend_history FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY trend_history_update ON opportunity_trend_history FOR UPDATE USING (app_is_admin());
CREATE POLICY trend_history_delete ON opportunity_trend_history FOR DELETE USING (app_is_admin());

CREATE POLICY opp_sources_select ON opportunity_sources FOR SELECT USING (app_is_active_user());
CREATE POLICY opp_sources_insert ON opportunity_sources FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY opp_sources_update ON opportunity_sources FOR UPDATE USING (app_is_admin());
CREATE POLICY opp_sources_delete ON opportunity_sources FOR DELETE USING (app_is_admin());

CREATE POLICY opp_alignments_select ON opportunity_amast_alignments FOR SELECT USING (app_is_active_user());
CREATE POLICY opp_alignments_insert ON opportunity_amast_alignments FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY opp_alignments_update ON opportunity_amast_alignments FOR UPDATE USING (app_is_admin());
CREATE POLICY opp_alignments_delete ON opportunity_amast_alignments FOR DELETE USING (app_is_admin());

-- opportunity_curation
CREATE POLICY curation_select_own   ON opportunity_curation FOR SELECT USING (user_id = app_current_user_id());
CREATE POLICY curation_select_admin ON opportunity_curation FOR SELECT USING (app_is_admin());
CREATE POLICY curation_insert_own   ON opportunity_curation FOR INSERT WITH CHECK (user_id = app_current_user_id());
CREATE POLICY curation_update_own   ON opportunity_curation FOR UPDATE USING (user_id = app_current_user_id());

-- opportunity_notes (append-only)
CREATE POLICY notes_select_own   ON opportunity_notes FOR SELECT USING (user_id = app_current_user_id());
CREATE POLICY notes_select_admin ON opportunity_notes FOR SELECT USING (app_is_admin());
CREATE POLICY notes_insert_own   ON opportunity_notes FOR INSERT WITH CHECK (user_id = app_current_user_id());

-- cron_job_logs — admin-only via service role; anon users cannot read
CREATE POLICY cron_logs_admin ON cron_job_logs FOR ALL USING (app_is_admin());

-- =============================================================
-- SEED DATA (safe to re-run)
-- Disable FK checks temporarily so order doesn't matter.
-- =============================================================

SET session_replication_role = replica;

INSERT INTO roles (name, description) VALUES
    ('admin',   'Full access — manages users, categories, opportunities, and domains'),
    ('analyst', 'Read and annotate opportunities; cannot manage users or lookup tables'),
    ('viewer',  'Read-only access to opportunity intelligence')
ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description) VALUES
    ('Emerging Tech', 'Technology products and platforms in early adoption or growth phase'),
    ('Emerging SaaS', 'Software-as-a-service products gaining market traction'),
    ('AI / ML',       'Artificial intelligence and machine learning applications'),
    ('Developer Tools','Tools and platforms targeting software developers')
ON CONFLICT (name) DO NOTHING;

-- IMPORTANT: amast_domain names must exactly match what the AI pipeline returns.
-- Add / rename rows here if the AI uses different names.
INSERT INTO amast_domains (name, description) VALUES
    ('AI',                    'Artificial Intelligence and Machine Learning solutions'),
    ('Logistics',             'Supply chain, warehousing, and last-mile delivery'),
    ('RFID',                  'Radio Frequency Identification and asset tracking'),
    ('Sales & Distribution',  'Sales force automation and distribution channel management'),
    ('IoT',                   'Internet of Things devices and connectivity platforms'),
    ('Analytics',             'Business intelligence, data analytics, and reporting tools'),
    ('Automation',            'Workflow automation, RPA, and process optimisation'),
    ('E-Commerce',            'Online retail, marketplace, and digital commerce platforms')
ON CONFLICT (name) DO NOTHING;

INSERT INTO data_sources (name, url, description) VALUES
    ('Hacker News',           'https://news.ycombinator.com',           'Tech community discussions and Show HN launches'),
    ('Reddit r/entrepreneur', 'https://www.reddit.com/r/entrepreneur',  'Entrepreneurship community insights'),
    ('Reddit r/SaaS',         'https://www.reddit.com/r/SaaS',          'SaaS founder community discussions'),
    ('GitHub Trending',       'https://github.com/trending',            'Trending open-source repositories'),
    ('Product Hunt',          'https://www.producthunt.com',            'Daily launches of new products and startups'),
    ('TechCrunch',            'https://techcrunch.com',                 'Technology news and startup coverage'),
    ('MIT Technology Review', 'https://www.technologyreview.com',       'Deep-dive technology research and analysis'),
    ('arXiv',                 'https://arxiv.org',                      'Preprint research papers in CS, AI, and related fields'),
    ('Dev.to',                'https://dev.to',                         'Developer community articles and tutorials'),
    ('IndieHackers',          'https://www.indiehackers.com',           'Indie founder revenue and traction stories')
ON CONFLICT (name) DO NOTHING;

SET session_replication_role = DEFAULT;

COMMIT;

-- =============================================================
-- NEXT STEP
-- After running this SQL, start the app and call:
--   POST /api/auth/bootstrap
--   { "email": "admin@example.com", "password": "YourPassword!1", "fullName": "Admin" }
-- This creates the first admin user. The endpoint disables itself
-- once any admin user exists.
-- =============================================================
