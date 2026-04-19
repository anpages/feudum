-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0021: column-level security for users + kingdoms
--
-- Problem: views public_profiles / public_kingdoms were SECURITY DEFINER, which
-- bypasses RLS on the underlying tables. Supabase's linter flags these as a
-- security risk, and any new column added to a view would silently leak data.
--
-- Fix:
--   1. Switch the views to security_invoker = true (respects caller's RLS).
--   2. Add USING (true) RLS policies on users + kingdoms so any authenticated
--      user can SELECT — but use column-level GRANTs to limit which columns
--      are actually readable by the anon/authenticated role.
--   3. Provide SECURITY DEFINER RPCs my_user() / my_kingdom() / my_kingdoms()
--      so a player can still read their OWN private columns (resources, units,
--      buildings, ether, email).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Views respect caller's RLS instead of bypassing it
ALTER VIEW "public_profiles" SET (security_invoker = true);
ALTER VIEW "public_kingdoms" SET (security_invoker = true);

-- 2. Public-read RLS policies (column-level GRANTs below restrict what's readable)
DROP POLICY IF EXISTS "users_select_public"    ON "users";
DROP POLICY IF EXISTS "kingdoms_select_public" ON "kingdoms";

CREATE POLICY "users_select_public"
  ON "users" FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "kingdoms_select_public"
  ON "kingdoms" FOR SELECT
  TO authenticated
  USING (true);

-- 3. Revoke broad SELECT, grant only public columns
REVOKE SELECT ON "users"    FROM authenticated;
REVOKE SELECT ON "kingdoms" FROM authenticated;

GRANT SELECT (
  id, username, character_class, is_admin, is_npc, created_at
) ON "users" TO authenticated;

GRANT SELECT (
  id, user_id, name, realm, region, slot, is_npc, is_boss, npc_level, created_at
) ON "kingdoms" TO authenticated;

-- 4. SECURITY DEFINER RPCs: the owner can read ALL their own columns
CREATE OR REPLACE FUNCTION my_user()
RETURNS SETOF "users"
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM "users" WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION my_kingdom(kid uuid DEFAULT NULL)
RETURNS SETOF "kingdoms"
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM "kingdoms"
   WHERE user_id = auth.uid()
     AND (kid IS NULL OR id = kid)
   ORDER BY created_at ASC
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION my_kingdoms()
RETURNS SETOF "kingdoms"
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM "kingdoms"
   WHERE user_id = auth.uid()
   ORDER BY created_at ASC
$$;

REVOKE EXECUTE ON FUNCTION my_user()             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION my_kingdom(uuid)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION my_kingdoms()         FROM PUBLIC;

GRANT  EXECUTE ON FUNCTION my_user()             TO authenticated;
GRANT  EXECUTE ON FUNCTION my_kingdom(uuid)      TO authenticated;
GRANT  EXECUTE ON FUNCTION my_kingdoms()         TO authenticated;

COMMIT;
