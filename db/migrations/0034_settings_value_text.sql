-- settings.value varchar(255) → text (needed for large JSON blobs like npc_tick_history)
ALTER TABLE "settings" ALTER COLUMN "value" TYPE text;
