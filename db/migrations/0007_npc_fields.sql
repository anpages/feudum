-- Phase 13: NPC kingdoms — add isNpc/npcLevel to kingdoms, isNpc to users, make googleId nullable

ALTER TABLE "kingdoms" ADD COLUMN IF NOT EXISTS "is_npc" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "kingdoms" ADD COLUMN IF NOT EXISTS "npc_level" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_npc" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "google_id" DROP NOT NULL;
