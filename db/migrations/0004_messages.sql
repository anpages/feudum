CREATE TABLE "messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id"),
  "type" varchar(20) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "data" text NOT NULL,
  "viewed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
