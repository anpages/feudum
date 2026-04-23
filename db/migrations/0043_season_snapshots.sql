-- Migration 0043: season_snapshots
-- Stores a snapshot of each human player's final state at the end of each season.
-- Populated by startNewSeason() before resetSeason() wipes the data.

CREATE TABLE IF NOT EXISTS "season_snapshots" (
  "id"                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"            uuid        REFERENCES "users"("id") ON DELETE SET NULL,
  "season_number"      integer     NOT NULL,
  "username"           varchar(50),
  "rank"               integer,
  "points"             integer     NOT NULL DEFAULT 0,
  "building_points"    integer     NOT NULL DEFAULT 0,
  "research_points"    integer     NOT NULL DEFAULT 0,
  "unit_points"        integer     NOT NULL DEFAULT 0,
  "achievements_count" integer     NOT NULL DEFAULT 0,
  "kingdoms_count"     integer     NOT NULL DEFAULT 0,
  "created_at"         timestamp   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "season_snapshots_user_idx"   ON "season_snapshots"("user_id");
CREATE INDEX IF NOT EXISTS "season_snapshots_season_idx" ON "season_snapshots"("season_number");
