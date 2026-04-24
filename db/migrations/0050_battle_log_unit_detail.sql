ALTER TABLE battle_log
  ADD COLUMN IF NOT EXISTS attacker_force jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attacker_lost  jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS defender_force jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS defender_lost  jsonb NOT NULL DEFAULT '{}';
