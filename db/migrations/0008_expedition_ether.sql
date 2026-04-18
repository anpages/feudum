ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ether" integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS "ether_transactions" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "type" text NOT NULL,
  "amount" integer NOT NULL,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
