-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0019 — Fresh reset to UUID-native schema with RLS
-- ─────────────────────────────────────────────────────────────────────────────
-- This is a destructive reset: all game data is wiped. Required because we
-- are switching the user PK from serial integer to UUID (= auth.users.id).
-- Post-reset: a trigger auto-creates a public.users row whenever a Supabase
-- auth user is created, so the lazy-create logic in /api/auth/me goes away.
-- RLS is enabled and SELECT-only policies allow the frontend to read directly.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 0. Wipe game tables (preserves drizzle migration meta + auth schema) ─────
DROP TABLE IF EXISTS "push_subscriptions"  CASCADE;
DROP TABLE IF EXISTS "user_achievements"   CASCADE;
DROP TABLE IF EXISTS "ether_transactions"  CASCADE;
DROP TABLE IF EXISTS "messages"            CASCADE;
DROP TABLE IF EXISTS "army_missions"       CASCADE;
DROP TABLE IF EXISTS "research_queue"      CASCADE;
DROP TABLE IF EXISTS "unit_queue"          CASCADE;
DROP TABLE IF EXISTS "building_queue"      CASCADE;
DROP TABLE IF EXISTS "research"            CASCADE;
DROP TABLE IF EXISTS "kingdoms"            CASCADE;
DROP TABLE IF EXISTS "debris_fields"       CASCADE;
DROP TABLE IF EXISTS "users"               CASCADE;
-- settings is a key/value config table — preserve it
-- (no FK to users, untouched by reset)

-- ── 1. users (PK = auth.users.id, UUID) ──────────────────────────────────────
CREATE TABLE "users" (
  "id"              uuid PRIMARY KEY,
  "username"        varchar(50) UNIQUE,
  "email"           varchar(255) NOT NULL UNIQUE,
  "avatar_url"      varchar(500),
  "is_admin"        boolean DEFAULT false NOT NULL,
  "is_npc"          boolean DEFAULT false NOT NULL,
  "ether"           integer DEFAULT 0 NOT NULL,
  "character_class" varchar(20),
  "created_at"      timestamp DEFAULT now() NOT NULL,
  "updated_at"      timestamp DEFAULT now() NOT NULL
);

-- Reserve a deterministic UUID for the NPC system user (no auth row backing)
INSERT INTO "users" ("id", "username", "email", "is_npc", "is_admin")
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'NPC', 'npc@feudum.local', true, false);

-- ── 2. ether_transactions ────────────────────────────────────────────────────
CREATE TABLE "ether_transactions" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"       text NOT NULL,
  "amount"     integer NOT NULL,
  "reason"     text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ── 3. kingdoms ──────────────────────────────────────────────────────────────
CREATE TABLE "kingdoms" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                  uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name"                     varchar(100) NOT NULL,
  "realm"                    integer NOT NULL,
  "region"                   integer NOT NULL,
  "slot"                     integer NOT NULL,

  "wood"                     real DEFAULT 500 NOT NULL,
  "wood_production"          real DEFAULT 0 NOT NULL,
  "wood_capacity"            real DEFAULT 10000 NOT NULL,
  "stone"                    real DEFAULT 500 NOT NULL,
  "stone_production"         real DEFAULT 0 NOT NULL,
  "stone_capacity"           real DEFAULT 10000 NOT NULL,
  "grain"                    real DEFAULT 500 NOT NULL,
  "grain_production"         real DEFAULT 0 NOT NULL,
  "grain_capacity"           real DEFAULT 10000 NOT NULL,
  "last_resource_update"     integer DEFAULT 0 NOT NULL,

  "sawmill"                  integer DEFAULT 0 NOT NULL,
  "quarry"                   integer DEFAULT 0 NOT NULL,
  "grain_farm"               integer DEFAULT 0 NOT NULL,
  "windmill"                 integer DEFAULT 0 NOT NULL,
  "cathedral"                integer DEFAULT 0 NOT NULL,
  "workshop"                 integer DEFAULT 0 NOT NULL,
  "engineers_guild"          integer DEFAULT 0 NOT NULL,
  "barracks"                 integer DEFAULT 0 NOT NULL,
  "granary"                  integer DEFAULT 0 NOT NULL,
  "stonehouse"               integer DEFAULT 0 NOT NULL,
  "silo"                     integer DEFAULT 0 NOT NULL,
  "academy"                  integer DEFAULT 0 NOT NULL,
  "alchemist_tower"          integer DEFAULT 0 NOT NULL,
  "ambassador_hall"          integer DEFAULT 0 NOT NULL,
  "armoury"                  integer DEFAULT 0 NOT NULL,

  "squire"                   integer DEFAULT 0 NOT NULL,
  "knight"                   integer DEFAULT 0 NOT NULL,
  "paladin"                  integer DEFAULT 0 NOT NULL,
  "warlord"                  integer DEFAULT 0 NOT NULL,
  "grand_knight"             integer DEFAULT 0 NOT NULL,
  "siege_master"             integer DEFAULT 0 NOT NULL,
  "war_machine"              integer DEFAULT 0 NOT NULL,
  "dragon_knight"            integer DEFAULT 0 NOT NULL,
  "merchant"                 integer DEFAULT 0 NOT NULL,
  "caravan"                  integer DEFAULT 0 NOT NULL,
  "colonist"                 integer DEFAULT 0 NOT NULL,
  "scavenger"                integer DEFAULT 0 NOT NULL,
  "scout"                    integer DEFAULT 0 NOT NULL,
  "beacon"                   integer DEFAULT 0 NOT NULL,

  "archer"                   integer DEFAULT 0 NOT NULL,
  "crossbowman"              integer DEFAULT 0 NOT NULL,
  "ballista"                 integer DEFAULT 0 NOT NULL,
  "trebuchet"                integer DEFAULT 0 NOT NULL,
  "mage_tower"               integer DEFAULT 0 NOT NULL,
  "dragon_cannon"            integer DEFAULT 0 NOT NULL,
  "palisade"                 integer DEFAULT 0 NOT NULL,
  "castle_wall"              integer DEFAULT 0 NOT NULL,
  "moat"                     integer DEFAULT 0 NOT NULL,
  "catapult"                 integer DEFAULT 0 NOT NULL,
  "ballistic"                integer DEFAULT 0 NOT NULL,

  "temp_avg"                 integer DEFAULT 0 NOT NULL,
  "sawmill_percent"          integer DEFAULT 10 NOT NULL,
  "quarry_percent"           integer DEFAULT 10 NOT NULL,
  "grain_farm_percent"       integer DEFAULT 10 NOT NULL,
  "windmill_percent"         integer DEFAULT 10 NOT NULL,
  "cathedral_percent"        integer DEFAULT 10 NOT NULL,

  "is_npc"                   boolean DEFAULT false NOT NULL,
  "is_boss"                  boolean DEFAULT false NOT NULL,
  "npc_level"                integer DEFAULT 0 NOT NULL,
  "npc_build_available_at"   integer DEFAULT 0,
  "npc_last_build_at"        integer DEFAULT 0 NOT NULL,
  "npc_last_attack_at"       integer DEFAULT 0 NOT NULL,

  "created_at"               timestamp DEFAULT now() NOT NULL,
  "updated_at"               timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "kingdoms_user_id_idx"        ON "kingdoms"("user_id");
CREATE INDEX "kingdoms_realm_region_slot"  ON "kingdoms"("realm","region","slot");
CREATE INDEX "kingdoms_is_npc_idx"         ON "kingdoms"("is_npc");

-- ── 4. research ──────────────────────────────────────────────────────────────
CREATE TABLE "research" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"             uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
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

-- ── 5. queues ────────────────────────────────────────────────────────────────
CREATE TABLE "building_queue" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kingdom_id"  uuid NOT NULL REFERENCES "kingdoms"("id") ON DELETE CASCADE,
  "building"    varchar(50) NOT NULL,
  "level"       integer NOT NULL,
  "started_at"  integer NOT NULL,
  "finishes_at" integer NOT NULL,
  "created_at"  timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "building_queue_kingdom_id_idx" ON "building_queue"("kingdom_id");

CREATE TABLE "research_queue" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kingdom_id"  uuid NOT NULL REFERENCES "kingdoms"("id") ON DELETE CASCADE,
  "research"    varchar(50) NOT NULL,
  "level"       integer NOT NULL,
  "started_at"  integer NOT NULL,
  "finishes_at" integer NOT NULL,
  "created_at"  timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "research_queue_user_id_idx" ON "research_queue"("user_id");

CREATE TABLE "unit_queue" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kingdom_id"  uuid NOT NULL REFERENCES "kingdoms"("id") ON DELETE CASCADE,
  "unit"        varchar(50) NOT NULL,
  "amount"      integer NOT NULL,
  "started_at"  integer NOT NULL,
  "finishes_at" integer NOT NULL,
  "created_at"  timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "unit_queue_kingdom_id_idx" ON "unit_queue"("kingdom_id");

-- ── 6. army_missions ─────────────────────────────────────────────────────────
CREATE TABLE "army_missions" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mission_type"   varchar(20) NOT NULL,
  "state"          varchar(10) DEFAULT 'active' NOT NULL,
  "start_realm"    integer NOT NULL,
  "start_region"   integer NOT NULL,
  "start_slot"     integer NOT NULL,
  "target_realm"   integer NOT NULL,
  "target_region"  integer NOT NULL,
  "target_slot"    integer NOT NULL,
  "departure_time" integer NOT NULL,
  "arrival_time"   integer NOT NULL,
  "return_time"    integer,
  "wood_load"      real DEFAULT 0 NOT NULL,
  "stone_load"     real DEFAULT 0 NOT NULL,
  "grain_load"     real DEFAULT 0 NOT NULL,
  "squire"         integer DEFAULT 0 NOT NULL,
  "knight"         integer DEFAULT 0 NOT NULL,
  "paladin"        integer DEFAULT 0 NOT NULL,
  "warlord"        integer DEFAULT 0 NOT NULL,
  "grand_knight"   integer DEFAULT 0 NOT NULL,
  "siege_master"   integer DEFAULT 0 NOT NULL,
  "war_machine"    integer DEFAULT 0 NOT NULL,
  "dragon_knight"  integer DEFAULT 0 NOT NULL,
  "merchant"       integer DEFAULT 0 NOT NULL,
  "caravan"        integer DEFAULT 0 NOT NULL,
  "colonist"       integer DEFAULT 0 NOT NULL,
  "scavenger"      integer DEFAULT 0 NOT NULL,
  "scout"          integer DEFAULT 0 NOT NULL,
  "ballistic"      integer DEFAULT 0 NOT NULL,
  "result"         text,
  "created_at"     timestamp DEFAULT now() NOT NULL,
  "updated_at"     timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "army_missions_user_id_idx"      ON "army_missions"("user_id");
CREATE INDEX "army_missions_arrival_time_idx" ON "army_missions"("arrival_time");

-- ── 7. messages ──────────────────────────────────────────────────────────────
CREATE TABLE "messages" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"       varchar(20) NOT NULL,
  "subject"    varchar(255) NOT NULL,
  "data"       text NOT NULL,
  "viewed"     boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id","created_at" DESC);

-- ── 8. debris_fields ─────────────────────────────────────────────────────────
CREATE TABLE "debris_fields" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "realm"      integer NOT NULL,
  "region"     integer NOT NULL,
  "slot"       integer NOT NULL,
  "wood"       real DEFAULT 0 NOT NULL,
  "stone"      real DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "debris_fields_coord_idx" ON "debris_fields"("realm","region","slot");

-- ── 9. user_achievements ─────────────────────────────────────────────────────
CREATE TABLE "user_achievements" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "achievement_id" varchar(60) NOT NULL,
  "unlocked_at"    timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "user_achievements_user_id_achievement_id"
  ON "user_achievements"("user_id","achievement_id");

-- ── 10. push_subscriptions ───────────────────────────────────────────────────
CREATE TABLE "push_subscriptions" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint"   text NOT NULL UNIQUE,
  "p256dh"     text NOT NULL,
  "auth"       text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RLS — SELECT-only policies (writes still go through /api with service role)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "users"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kingdoms"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "building_queue"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "research_queue"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "unit_queue"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "army_missions"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "debris_fields"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_achievements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ether_transactions" ENABLE ROW LEVEL SECURITY;

-- Users: each user reads their own row. Other player profiles (for rankings)
-- are exposed via the `public_profiles` view below — never grant SELECT * here.
CREATE POLICY "users_select_own"
  ON "users" FOR SELECT
  USING (auth.uid() = id);

-- Kingdoms: a user can read their own kingdoms (gameplay) AND any kingdom for
-- map/rankings purposes. Sensitive columns (resources, units, defenses) MUST
-- be exposed only via dedicated views — see kingdoms_public below.
CREATE POLICY "kingdoms_select_own"
  ON "kingdoms" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "research_select_own"
  ON "research" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "building_queue_select_own"
  ON "building_queue" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "kingdoms" k WHERE k.id = building_queue.kingdom_id AND k.user_id = auth.uid()));

CREATE POLICY "research_queue_select_own"
  ON "research_queue" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "unit_queue_select_own"
  ON "unit_queue" FOR SELECT
  USING (EXISTS (SELECT 1 FROM "kingdoms" k WHERE k.id = unit_queue.kingdom_id AND k.user_id = auth.uid()));

CREATE POLICY "army_missions_select_own"
  ON "army_missions" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "messages_select_own"
  ON "messages" FOR SELECT
  USING (auth.uid() = user_id);

-- Debris fields visible to everyone with a session (positional, no PII)
CREATE POLICY "debris_fields_select_authenticated"
  ON "debris_fields" FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "user_achievements_select_own"
  ON "user_achievements" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "push_subscriptions_select_own"
  ON "push_subscriptions" FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "ether_transactions_select_own"
  ON "ether_transactions" FOR SELECT
  USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Public views for cross-player visibility (rankings, map)
-- ─────────────────────────────────────────────────────────────────────────────
-- Views run with the privileges of the view owner (postgres) and bypass RLS
-- on the underlying tables — but we hand-pick columns so only safe public
-- info is exposed (no resources, no troop counts).

CREATE OR REPLACE VIEW "public_profiles" AS
  SELECT id, username, character_class, is_admin, created_at
  FROM "users";

CREATE OR REPLACE VIEW "public_kingdoms" AS
  SELECT id, user_id, name, realm, region, slot,
         is_npc, is_boss, npc_level, created_at
  FROM "kingdoms";

GRANT SELECT ON "public_profiles" TO authenticated;
GRANT SELECT ON "public_kingdoms" TO authenticated;
GRANT SELECT ON "debris_fields"   TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Auto-create public.users row when a Supabase auth user signs up
-- ─────────────────────────────────────────────────────────────────────────────
-- Replaces the lazy-create logic in /api/auth/me. Runs as SECURITY DEFINER so
-- it can write to public.users without an authenticated session yet.

CREATE OR REPLACE FUNCTION "handle_new_auth_user"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_email text := current_setting('app.admin_email', true);
BEGIN
  INSERT INTO public.users (id, email, avatar_url, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.email = admin_email, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "on_auth_user_created" ON auth.users;
CREATE TRIGGER "on_auth_user_created"
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION "handle_new_auth_user"();

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. Realtime — enable the supabase_realtime publication for game tables
-- ─────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE
  "kingdoms",
  "building_queue",
  "research_queue",
  "unit_queue",
  "army_missions",
  "messages",
  "user_achievements";

COMMIT;
