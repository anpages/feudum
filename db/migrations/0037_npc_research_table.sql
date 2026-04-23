-- NPC research rows keyed by kingdom_id (NPCs share one userId so the
-- player research table cannot be used directly).
CREATE TABLE IF NOT EXISTS "npc_research" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kingdom_id"          uuid NOT NULL UNIQUE REFERENCES "kingdoms"("id") ON DELETE CASCADE,

  "swordsmanship"       integer DEFAULT 0 NOT NULL,
  "armoury"             integer DEFAULT 0 NOT NULL,
  "fortification"       integer DEFAULT 0 NOT NULL,

  "horsemanship"        integer DEFAULT 0 NOT NULL,
  "cartography"         integer DEFAULT 0 NOT NULL,
  "trade_routes"        integer DEFAULT 0 NOT NULL,

  "alchemy"             integer DEFAULT 0 NOT NULL,
  "pyromancy"           integer DEFAULT 0 NOT NULL,
  "runemastery"         integer DEFAULT 0 NOT NULL,
  "mysticism"           integer DEFAULT 0 NOT NULL,
  "dragonlore"          integer DEFAULT 0 NOT NULL,

  "spycraft"            integer DEFAULT 0 NOT NULL,
  "logistics"           integer DEFAULT 0 NOT NULL,
  "exploration"         integer DEFAULT 0 NOT NULL,
  "diplomatic_network"  integer DEFAULT 0 NOT NULL,
  "divine_blessing"     integer DEFAULT 0 NOT NULL,

  "created_at"          timestamp DEFAULT now() NOT NULL,
  "updated_at"          timestamp DEFAULT now() NOT NULL
);

-- Research queue tracking on the kingdoms row
ALTER TABLE "kingdoms"
  ADD COLUMN IF NOT EXISTS "npc_research_available_at" integer,
  ADD COLUMN IF NOT EXISTS "npc_current_research"      varchar(50);
