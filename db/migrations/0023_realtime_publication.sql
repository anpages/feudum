-- ─────────────────────────────────────────────────────────────────────────────
-- 0023 — Realtime publication + RLS for game tables
--
-- Goal: enable Supabase Realtime push (postgres_changes) for the tables that
-- the client subscribes to in src/features/realtime/useRealtime.ts, and
-- guarantee that each authenticated user only receives events for their own
-- rows via RLS SELECT policies.
--
-- Why per-table: kingdoms is intentionally NOT added to the publication.
-- Reading kingdoms rows is column-restricted (see migration 0021), and we
-- already invalidate the ['kingdom'] React Query whenever building_queue /
-- research_queue / unit_queue / army_missions changes — that triggers a fresh
-- REST fetch using the user's JWT and goes through my_kingdom() RPC, which
-- reads ALL columns for the owner. So pushing kingdoms changes is redundant.
--
-- REPLICA IDENTITY FULL: required so DELETE events carry enough column data
-- for RLS to evaluate the policy (otherwise the deleted row is filtered out
-- and the client never sees that a queue item finished/was cancelled).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Enable RLS + SELECT policies ─────────────────────────────────────────

-- building_queue: scoped via kingdom ownership
ALTER TABLE "building_queue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "building_queue_select_own" ON "building_queue";
CREATE POLICY "building_queue_select_own"
  ON "building_queue" FOR SELECT
  TO authenticated
  USING (kingdom_id IN (SELECT id FROM "kingdoms" WHERE user_id = auth.uid()));

-- unit_queue: scoped via kingdom ownership
ALTER TABLE "unit_queue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unit_queue_select_own" ON "unit_queue";
CREATE POLICY "unit_queue_select_own"
  ON "unit_queue" FOR SELECT
  TO authenticated
  USING (kingdom_id IN (SELECT id FROM "kingdoms" WHERE user_id = auth.uid()));

-- research_queue: user-scoped directly
ALTER TABLE "research_queue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "research_queue_select_own" ON "research_queue";
CREATE POLICY "research_queue_select_own"
  ON "research_queue" FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- army_missions: user-scoped directly
ALTER TABLE "army_missions" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "army_missions_select_own" ON "army_missions";
CREATE POLICY "army_missions_select_own"
  ON "army_missions" FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- messages: user-scoped (UPDATE policy already exists in 0022, add SELECT)
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_select_own" ON "messages";
CREATE POLICY "messages_select_own"
  ON "messages" FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- user_achievements: user-scoped directly
ALTER TABLE "user_achievements" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_achievements_select_own" ON "user_achievements";
CREATE POLICY "user_achievements_select_own"
  ON "user_achievements" FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ── 2. Grants ───────────────────────────────────────────────────────────────

GRANT SELECT ON "building_queue"    TO authenticated;
GRANT SELECT ON "unit_queue"        TO authenticated;
GRANT SELECT ON "research_queue"    TO authenticated;
GRANT SELECT ON "army_missions"     TO authenticated;
GRANT SELECT ON "messages"          TO authenticated;
GRANT SELECT ON "user_achievements" TO authenticated;

-- ── 3. REPLICA IDENTITY FULL for proper DELETE events under RLS ─────────────

ALTER TABLE "building_queue"    REPLICA IDENTITY FULL;
ALTER TABLE "unit_queue"        REPLICA IDENTITY FULL;
ALTER TABLE "research_queue"    REPLICA IDENTITY FULL;
ALTER TABLE "army_missions"     REPLICA IDENTITY FULL;
ALTER TABLE "messages"          REPLICA IDENTITY FULL;
ALTER TABLE "user_achievements" REPLICA IDENTITY FULL;

-- ── 4. Add to supabase_realtime publication (idempotent) ────────────────────

DO $$
DECLARE
  _tbl text;
BEGIN
  FOR _tbl IN
    SELECT unnest(ARRAY[
      'building_queue','unit_queue','research_queue',
      'army_missions','messages','user_achievements'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND tablename = _tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', _tbl);
    END IF;
  END LOOP;
END;
$$;

COMMIT;
