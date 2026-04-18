-- Admin panel: is_admin flag on users + settings key-value table

ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE "settings" (
  "key"        varchar(100) PRIMARY KEY NOT NULL,
  "value"      varchar(255) NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "settings" ("key", "value") VALUES
  ('economy_speed',       '1'),
  ('research_speed',      '1'),
  ('fleet_speed_war',     '1'),
  ('fleet_speed_peaceful','1'),
  ('basic_wood',          '30'),
  ('basic_stone',         '15')
ON CONFLICT ("key") DO NOTHING;
