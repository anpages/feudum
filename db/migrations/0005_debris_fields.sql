CREATE TABLE "debris_fields" (
  "id"        serial PRIMARY KEY NOT NULL,
  "realm"     integer NOT NULL,
  "region"    integer NOT NULL,
  "slot"      integer NOT NULL,
  "wood"      real DEFAULT 0 NOT NULL,
  "stone"     real DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
