-- ============================================================
-- Migration 0040: Clean kingdoms table
--
-- kingdoms now holds only: id, user_id, name, coordinates,
-- resources (wood/stone/grain + production/capacity), timestamps.
--
-- NPC AI state moves to npc_state (one row per NPC user).
-- Cosmetic/override columns (temp_avg, *_percent) are dropped.
-- is_npc is dropped — derivable from users.role = 'npc'.
-- ============================================================

BEGIN;

-- ── 1. npc_state table ────────────────────────────────────────────────────────

CREATE TABLE npc_state (
  user_id              uuid    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_boss              boolean NOT NULL DEFAULT false,
  npc_level            integer NOT NULL DEFAULT 1,
  build_available_at   integer,
  last_build_at        integer NOT NULL DEFAULT 0,
  last_attack_at       integer NOT NULL DEFAULT 0,
  next_check           integer,
  last_decision        varchar(255),
  current_research     varchar(50),
  research_available_at integer,
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now()
);

ALTER TABLE npc_state ENABLE ROW LEVEL SECURITY;

-- ── 2. Migrate NPC state from kingdoms → npc_state ───────────────────────────

INSERT INTO npc_state (
  user_id, is_boss, npc_level,
  build_available_at, last_build_at, last_attack_at,
  current_research, research_available_at
)
SELECT
  k.user_id,
  k.is_boss,
  COALESCE(k.npc_level, 1),
  k.npc_build_available_at,
  COALESCE(k.npc_last_build_at, 0),
  COALESCE(k.npc_last_attack_at, 0),
  k.npc_current_research,
  k.npc_research_available_at
FROM kingdoms k
JOIN users u ON u.id = k.user_id
WHERE u.role = 'npc';

-- ── 3. Recreate public_kingdoms view (drops dependency on removed columns) ───

DROP VIEW IF EXISTS public_kingdoms;

CREATE OR REPLACE VIEW public_kingdoms AS
  SELECT k.id, k.user_id, k.name,
         k.realm, k.region, k.slot,
         (u.role = 'npc')  AS is_npc,
         COALESCE(ns.is_boss, false) AS is_boss,
         ns.npc_level,
         k.created_at
  FROM kingdoms k
  JOIN users u ON u.id = k.user_id
  LEFT JOIN npc_state ns ON ns.user_id = k.user_id;

-- ── 4. Drop removed columns from kingdoms ────────────────────────────────────

ALTER TABLE kingdoms
  DROP COLUMN is_npc,
  DROP COLUMN is_boss,
  DROP COLUMN npc_level,
  DROP COLUMN npc_build_available_at,
  DROP COLUMN npc_last_build_at,
  DROP COLUMN npc_last_attack_at,
  DROP COLUMN npc_research_available_at,
  DROP COLUMN npc_current_research,
  DROP COLUMN temp_avg,
  DROP COLUMN sawmill_percent,
  DROP COLUMN quarry_percent,
  DROP COLUMN grain_farm_percent,
  DROP COLUMN windmill_percent,
  DROP COLUMN cathedral_percent;

COMMIT;
