-- ============================================================
-- Migration 0039: RLS policies — deny-all for non-owner roles
--
-- This app uses a custom JWT (not Supabase Auth), so all legitimate
-- DB access goes through the Hono API which connects as the 'postgres'
-- role. As the table owner, postgres bypasses RLS automatically.
--
-- Goal: block any direct Supabase client access (anon key, authenticated)
-- while keeping the API working without any changes.
--
-- Three dangerous open policies are dropped:
--   kingdoms_select_public  — USING:true for authenticated (exposes all kingdoms)
--   users_select_public     — USING:true for authenticated (exposes all users)
--   settings_select_all     — USING:true for authenticated (exposes settings)
--   debris_fields_select_authenticated — allows any authenticated role
-- ============================================================

-- ── 1. Drop open/dangerous policies ──────────────────────────────────────────

DROP POLICY IF EXISTS kingdoms_select_public          ON kingdoms;
DROP POLICY IF EXISTS users_select_public             ON users;
DROP POLICY IF EXISTS settings_select_all             ON settings;
DROP POLICY IF EXISTS debris_fields_select_authenticated ON debris_fields;

-- ── 2. Enable RLS on the three new tables (created in migration 0038) ────────

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE units     ENABLE ROW LEVEL SECURITY;
ALTER TABLE research  ENABLE ROW LEVEL SECURITY;

-- No policies added: postgres (table owner) bypasses RLS by default.
-- Any other role (anon, authenticated) gets denied on all tables.
-- The remaining auth.uid()-based policies on other tables are harmless —
-- auth.uid() always returns NULL with our custom JWT, so they block everyone.
