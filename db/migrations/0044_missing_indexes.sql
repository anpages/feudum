-- Migration 0044: indexes on normalized FK columns
-- After schema normalization (buildings/units/research as row tables),
-- these FK columns are queried on every API request but had no indexes.

CREATE INDEX IF NOT EXISTS idx_buildings_kingdom_id ON buildings(kingdom_id);
CREATE INDEX IF NOT EXISTS idx_units_kingdom_id     ON units(kingdom_id);
CREATE INDEX IF NOT EXISTS idx_research_user_id     ON research(user_id);

-- Composite indexes for the upsert conflict targets (also speed up type lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_kingdom_type ON buildings(kingdom_id, type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_units_kingdom_type     ON units(kingdom_id, type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_research_user_type     ON research(user_id, type);

-- battle_log: queried by attacker/defender kingdom in reports and rankings
CREATE INDEX IF NOT EXISTS idx_battle_log_attacker ON battle_log(attacker_kingdom_id);
CREATE INDEX IF NOT EXISTS idx_battle_log_defender ON battle_log(defender_kingdom_id);

-- army_missions: queried by state + arrivalTime in combat-engine every minute
CREATE INDEX IF NOT EXISTS idx_army_missions_state_arrival ON army_missions(state, arrival_time);

-- npc_state: joined to kingdoms/users in rankings and NPC tick
CREATE INDEX IF NOT EXISTS idx_npc_state_is_boss ON npc_state(is_boss) WHERE is_boss = true;
