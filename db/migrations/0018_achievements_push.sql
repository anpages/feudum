ALTER TABLE "kingdoms" ADD COLUMN IF NOT EXISTS "is_boss" boolean DEFAULT false NOT NULL;
ALTER TABLE "kingdoms" ADD COLUMN IF NOT EXISTS "npc_last_build_at" integer DEFAULT 0 NOT NULL;
ALTER TABLE "kingdoms" ADD COLUMN IF NOT EXISTS "npc_last_attack_at" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "user_achievements" (
  "id"             serial PRIMARY KEY,
  "user_id"        integer NOT NULL REFERENCES "users"("id"),
  "achievement_id" varchar(60) NOT NULL,
  "unlocked_at"    timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_user_id_achievement_id" ON "user_achievements"("user_id","achievement_id");

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id"         serial PRIMARY KEY,
  "user_id"    integer NOT NULL REFERENCES "users"("id"),
  "endpoint"   text NOT NULL UNIQUE,
  "p256dh"     text NOT NULL,
  "auth"       text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
