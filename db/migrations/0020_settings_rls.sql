-- ─────────────────────────────────────────────────────────────────────────────
-- 0020 — Public read on settings + GRANT
--
-- The client needs economy_speed / research_speed / basic_wood / basic_stone /
-- season_* to derive costs, build times, production rates and the season banner
-- without round-tripping the API. The settings table is non-sensitive global
-- game config (no PII, no per-user data), so we expose it read-only to any
-- authenticated user.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_all" ON "settings";
CREATE POLICY "settings_select_all"
  ON "settings" FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON "settings" TO authenticated;

-- Realtime — broadcast settings changes (admin tweaks economy_speed, season transitions, etc.)
ALTER PUBLICATION supabase_realtime ADD TABLE "settings";
