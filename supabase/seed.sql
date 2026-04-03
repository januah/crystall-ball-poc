-- =============================================================
-- Crystal Ball — Seed Data
-- Run AFTER schema.sql. Safe to re-run (ON CONFLICT DO NOTHING).
-- =============================================================

-- Disable RLS for seeding (run as superuser / service role)
SET session_replication_role = replica;

-- Roles
INSERT INTO roles (name, description) VALUES
    ('admin',    'Full access — manages users, categories, opportunities, and domains'),
    ('analyst',  'Read and annotate opportunities; cannot manage users or lookup tables'),
    ('viewer',   'Read-only access to opportunity intelligence')
ON CONFLICT (name) DO NOTHING;

-- Categories
INSERT INTO categories (name, description) VALUES
    ('Emerging Tech',  'Technology products and platforms in early adoption or growth phase'),
    ('Emerging SaaS',  'Software-as-a-service products gaining market traction')
ON CONFLICT (name) DO NOTHING;

-- AMAST Domains
INSERT INTO amast_domains (name, description) VALUES
    ('AI',                   'Artificial Intelligence and Machine Learning solutions'),
    ('Logistics',            'Supply chain, warehousing, and last-mile delivery'),
    ('RFID',                 'Radio Frequency Identification and asset tracking'),
    ('Sales & Distribution', 'Sales force automation and distribution channel management')
ON CONFLICT (name) DO NOTHING;

-- Data Sources
INSERT INTO data_sources (name, url, description) VALUES
    ('Product Hunt',          'https://www.producthunt.com',            'Daily launches of new products and startups'),
    ('Hacker News',           'https://news.ycombinator.com',           'Tech community discussions and Show HN launches'),
    ('Crunchbase',            'https://www.crunchbase.com',             'Startup funding rounds and company intelligence'),
    ('GitHub Trending',       'https://github.com/trending',            'Trending open-source repositories'),
    ('Reddit r/entrepreneur', 'https://www.reddit.com/r/entrepreneur',  'Entrepreneurship community insights'),
    ('Reddit r/SaaS',         'https://www.reddit.com/r/SaaS',          'SaaS founder community discussions'),
    ('G2 Crowd',              'https://www.g2.com',                     'Software reviews and product category trends'),
    ('CB Insights',           'https://www.cbinsights.com',             'Market intelligence and emerging tech reports'),
    ('TechCrunch',            'https://techcrunch.com',                 'Technology news and startup coverage'),
    ('MIT Technology Review', 'https://www.technologyreview.com',       'Deep-dive technology research and analysis'),
    ('arXiv',                 'https://arxiv.org',                      'Preprint research papers in CS, AI, and related fields')
ON CONFLICT (name) DO NOTHING;

SET session_replication_role = DEFAULT;
