-- Formas de Vida (Lifeforms) — civilization system
-- Columns added to kingdoms table
ALTER TABLE kingdoms
  ADD COLUMN IF NOT EXISTS civilization         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS civ_level_romans     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS civ_level_vikings    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS civ_level_byzantines INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS civ_level_saracens   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS population_t1        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS population_t2        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS population_t3        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS food_stored          REAL    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS food_last_update     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artifacts            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lf_buildings         JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lf_research          JSONB   NOT NULL DEFAULT '{}';

-- LF building construction queue
CREATE TABLE IF NOT EXISTS lf_building_queue (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kingdom_id  UUID        NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  building    VARCHAR(60) NOT NULL,
  level       INTEGER     NOT NULL,
  started_at  INTEGER     NOT NULL,
  finishes_at INTEGER     NOT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- LF research queue
CREATE TABLE IF NOT EXISTS lf_research_queue (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kingdom_id  UUID        NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  research    VARCHAR(60) NOT NULL,
  level       INTEGER     NOT NULL,
  started_at  INTEGER     NOT NULL,
  finishes_at INTEGER     NOT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);
