-- Optimize RLS policies: wrap auth.uid() in (select ...) to avoid per-row re-evaluation
-- Also remove redundant permissive policies on kingdoms and users
-- Fixes Supabase performance advisors: auth_rls_initplan + multiple_permissive_policies

-- kingdoms_select_own is redundant — kingdoms_select_public (true) already covers it
DROP POLICY IF EXISTS "kingdoms_select_own" ON kingdoms;
-- users_select_own is redundant — users_select_public (true) already covers it
DROP POLICY IF EXISTS "users_select_own" ON users;

-- Recreate all auth.uid() policies with (select auth.uid()) for single evaluation per query

DROP POLICY IF EXISTS "army_missions_select_own" ON army_missions;
CREATE POLICY "army_missions_select_own" ON army_missions
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "messages_select_own" ON messages;
CREATE POLICY "messages_select_own" ON messages
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "research_select_own" ON research;
CREATE POLICY "research_select_own" ON research
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON push_subscriptions
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ether_transactions_select_own" ON ether_transactions;
CREATE POLICY "ether_transactions_select_own" ON ether_transactions
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "user_achievements_select_own" ON user_achievements;
CREATE POLICY "user_achievements_select_own" ON user_achievements
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "debris_fields_select_authenticated" ON debris_fields;
CREATE POLICY "debris_fields_select_authenticated" ON debris_fields
  FOR SELECT USING ((select auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "building_queue_select_own" ON building_queue;
CREATE POLICY "building_queue_select_own" ON building_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kingdoms k
      WHERE k.id = building_queue.kingdom_id
        AND k.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "research_queue_select_own" ON research_queue;
CREATE POLICY "research_queue_select_own" ON research_queue
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "unit_queue_select_own" ON unit_queue;
CREATE POLICY "unit_queue_select_own" ON unit_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kingdoms k
      WHERE k.id = unit_queue.kingdom_id
        AND k.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "battle_log_select_participant" ON battle_log;
CREATE POLICY "battle_log_select_participant" ON battle_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kingdoms k
      WHERE k.user_id = (select auth.uid())
        AND (k.id = battle_log.attacker_kingdom_id OR k.id = battle_log.defender_kingdom_id)
    )
  );

DROP POLICY IF EXISTS "lf_building_queue_select_own" ON lf_building_queue;
CREATE POLICY "lf_building_queue_select_own" ON lf_building_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kingdoms k
      WHERE k.id = lf_building_queue.kingdom_id
        AND k.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "lf_research_queue_select_own" ON lf_research_queue;
CREATE POLICY "lf_research_queue_select_own" ON lf_research_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM kingdoms k
      WHERE k.id = lf_research_queue.kingdom_id
        AND k.user_id = (select auth.uid())
    )
  );
