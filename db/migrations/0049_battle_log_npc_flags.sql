ALTER TABLE battle_log
  ADD COLUMN IF NOT EXISTS attacker_is_npc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS defender_is_npc boolean NOT NULL DEFAULT false;
