-- Migration 0045: RLS SELECT policies for buildings and units tables
-- These tables were enabled with RLS but had no policies (deny-all).
-- Frontend services need to read them directly via Supabase client (auth.uid() = Google OAuth).

CREATE POLICY "buildings_select_own" ON buildings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kingdoms k
      WHERE k.id = buildings.kingdom_id
        AND k.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "units_select_own" ON units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kingdoms k
      WHERE k.id = units.kingdom_id
        AND k.user_id = (SELECT auth.uid())
    )
  );
