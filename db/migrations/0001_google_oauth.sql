-- Switch from password-based auth to Google OAuth
-- WARNING: clears all existing user data (dev only)
TRUNCATE TABLE "army_missions", "unit_queue", "research_queue", "building_queue", "research", "kingdoms", "users" CASCADE;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "last_ip";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" varchar(255) NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" varchar(500);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");
