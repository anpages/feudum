-- Enable RLS on tables that were missing it (Supabase security alert 2026-04-22)

ALTER TABLE battle_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "battle_log_select_participant" ON battle_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kingdoms k
      WHERE k.user_id = auth.uid()
        AND (k.id = battle_log.attacker_kingdom_id OR k.id = battle_log.defender_kingdom_id)
    )
  );

ALTER TABLE lf_building_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lf_building_queue_select_own" ON lf_building_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kingdoms k
      WHERE k.id = lf_building_queue.kingdom_id AND k.user_id = auth.uid()
    )
  );

ALTER TABLE lf_research_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lf_research_queue_select_own" ON lf_research_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kingdoms k
      WHERE k.id = lf_research_queue.kingdom_id AND k.user_id = auth.uid()
    )
  );
