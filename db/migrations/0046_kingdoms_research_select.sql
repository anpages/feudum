-- Migration 0046: restore SELECT policies broken by earlier migrations.
--
-- Migration 0039 dropped kingdoms_select_public (correct — prevents exposing all kingdoms).
-- But it left kingdoms with RLS enabled and ZERO SELECT policies, which breaks every other
-- policy that uses a kingdoms subquery (building_queue, unit_queue, buildings, units).
--
-- Fix 1: kingdoms_select_own — users can read their OWN kingdoms only.
--   This is safe: does NOT expose other players' kingdoms.
--   Re-enables subqueries in buildings_select_own, units_select_own,
--   building_queue_select_own, and unit_queue_select_own.
--
-- Fix 2: research_select_own — was created in 0030 but lost when migration 0038
--   recreated the research table during schema normalization.

CREATE POLICY "kingdoms_select_own" ON kingdoms
  FOR SELECT USING (user_id = (SELECT auth.uid()));

CREATE POLICY "research_select_own" ON research
  FOR SELECT USING (user_id = (SELECT auth.uid()));
