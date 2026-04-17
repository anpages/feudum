CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"last_ip" varchar(45),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "kingdoms" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"realm" integer NOT NULL,
	"region" integer NOT NULL,
	"slot" integer NOT NULL,
	"wood" real DEFAULT 500 NOT NULL,
	"wood_production" real DEFAULT 0 NOT NULL,
	"wood_capacity" real DEFAULT 10000 NOT NULL,
	"stone" real DEFAULT 500 NOT NULL,
	"stone_production" real DEFAULT 0 NOT NULL,
	"stone_capacity" real DEFAULT 10000 NOT NULL,
	"grain" real DEFAULT 500 NOT NULL,
	"grain_production" real DEFAULT 0 NOT NULL,
	"grain_capacity" real DEFAULT 10000 NOT NULL,
	"population_used" integer DEFAULT 0 NOT NULL,
	"population_max" integer DEFAULT 0 NOT NULL,
	"last_resource_update" integer DEFAULT 0 NOT NULL,
	"sawmill" integer DEFAULT 0 NOT NULL,
	"quarry" integer DEFAULT 0 NOT NULL,
	"grain_farm" integer DEFAULT 0 NOT NULL,
	"windmill" integer DEFAULT 0 NOT NULL,
	"cathedral" integer DEFAULT 0 NOT NULL,
	"workshop" integer DEFAULT 0 NOT NULL,
	"engineers_guild" integer DEFAULT 0 NOT NULL,
	"barracks" integer DEFAULT 0 NOT NULL,
	"granary" integer DEFAULT 0 NOT NULL,
	"stonehouse" integer DEFAULT 0 NOT NULL,
	"silo" integer DEFAULT 0 NOT NULL,
	"academy" integer DEFAULT 0 NOT NULL,
	"alchemist_tower" integer DEFAULT 0 NOT NULL,
	"ambassador_hall" integer DEFAULT 0 NOT NULL,
	"armoury" integer DEFAULT 0 NOT NULL,
	"squire" integer DEFAULT 0 NOT NULL,
	"knight" integer DEFAULT 0 NOT NULL,
	"paladin" integer DEFAULT 0 NOT NULL,
	"warlord" integer DEFAULT 0 NOT NULL,
	"grand_knight" integer DEFAULT 0 NOT NULL,
	"siege_master" integer DEFAULT 0 NOT NULL,
	"war_machine" integer DEFAULT 0 NOT NULL,
	"dragon_knight" integer DEFAULT 0 NOT NULL,
	"merchant" integer DEFAULT 0 NOT NULL,
	"caravan" integer DEFAULT 0 NOT NULL,
	"colonist" integer DEFAULT 0 NOT NULL,
	"scavenger" integer DEFAULT 0 NOT NULL,
	"scout" integer DEFAULT 0 NOT NULL,
	"beacon" integer DEFAULT 0 NOT NULL,
	"archer" integer DEFAULT 0 NOT NULL,
	"crossbowman" integer DEFAULT 0 NOT NULL,
	"ballista" integer DEFAULT 0 NOT NULL,
	"trebuchet" integer DEFAULT 0 NOT NULL,
	"mage_tower" integer DEFAULT 0 NOT NULL,
	"dragon_cannon" integer DEFAULT 0 NOT NULL,
	"palisade" integer DEFAULT 0 NOT NULL,
	"castle_wall" integer DEFAULT 0 NOT NULL,
	"moat" integer DEFAULT 0 NOT NULL,
	"catapult" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"swordsmanship" integer DEFAULT 0 NOT NULL,
	"armoury" integer DEFAULT 0 NOT NULL,
	"fortification" integer DEFAULT 0 NOT NULL,
	"horsemanship" integer DEFAULT 0 NOT NULL,
	"cartography" integer DEFAULT 0 NOT NULL,
	"trade_routes" integer DEFAULT 0 NOT NULL,
	"alchemy" integer DEFAULT 0 NOT NULL,
	"pyromancy" integer DEFAULT 0 NOT NULL,
	"runemastery" integer DEFAULT 0 NOT NULL,
	"mysticism" integer DEFAULT 0 NOT NULL,
	"dragonlore" integer DEFAULT 0 NOT NULL,
	"spycraft" integer DEFAULT 0 NOT NULL,
	"logistics" integer DEFAULT 0 NOT NULL,
	"exploration" integer DEFAULT 0 NOT NULL,
	"diplomatic_network" integer DEFAULT 0 NOT NULL,
	"divine_blessing" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "research_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "building_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"kingdom_id" integer NOT NULL,
	"building" varchar(50) NOT NULL,
	"level" integer NOT NULL,
	"started_at" integer NOT NULL,
	"finishes_at" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kingdom_id" integer NOT NULL,
	"research" varchar(50) NOT NULL,
	"level" integer NOT NULL,
	"started_at" integer NOT NULL,
	"finishes_at" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"kingdom_id" integer NOT NULL,
	"unit" varchar(50) NOT NULL,
	"amount" integer NOT NULL,
	"started_at" integer NOT NULL,
	"finishes_at" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "army_missions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"mission_type" varchar(20) NOT NULL,
	"state" varchar(10) DEFAULT 'active' NOT NULL,
	"start_realm" integer NOT NULL,
	"start_region" integer NOT NULL,
	"start_slot" integer NOT NULL,
	"target_realm" integer NOT NULL,
	"target_region" integer NOT NULL,
	"target_slot" integer NOT NULL,
	"departure_time" integer NOT NULL,
	"arrival_time" integer NOT NULL,
	"return_time" integer,
	"wood_load" real DEFAULT 0 NOT NULL,
	"stone_load" real DEFAULT 0 NOT NULL,
	"grain_load" real DEFAULT 0 NOT NULL,
	"squire" integer DEFAULT 0 NOT NULL,
	"knight" integer DEFAULT 0 NOT NULL,
	"paladin" integer DEFAULT 0 NOT NULL,
	"warlord" integer DEFAULT 0 NOT NULL,
	"grand_knight" integer DEFAULT 0 NOT NULL,
	"siege_master" integer DEFAULT 0 NOT NULL,
	"war_machine" integer DEFAULT 0 NOT NULL,
	"dragon_knight" integer DEFAULT 0 NOT NULL,
	"merchant" integer DEFAULT 0 NOT NULL,
	"caravan" integer DEFAULT 0 NOT NULL,
	"colonist" integer DEFAULT 0 NOT NULL,
	"scavenger" integer DEFAULT 0 NOT NULL,
	"scout" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kingdoms" ADD CONSTRAINT "kingdoms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research" ADD CONSTRAINT "research_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_queue" ADD CONSTRAINT "building_queue_kingdom_id_kingdoms_id_fk" FOREIGN KEY ("kingdom_id") REFERENCES "public"."kingdoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_queue" ADD CONSTRAINT "research_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_queue" ADD CONSTRAINT "research_queue_kingdom_id_kingdoms_id_fk" FOREIGN KEY ("kingdom_id") REFERENCES "public"."kingdoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_queue" ADD CONSTRAINT "unit_queue_kingdom_id_kingdoms_id_fk" FOREIGN KEY ("kingdom_id") REFERENCES "public"."kingdoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "army_missions" ADD CONSTRAINT "army_missions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;