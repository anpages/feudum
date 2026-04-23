-- ============================================================
-- Migration 0041: Final cleanup — FKs, JSONB, UNIQUE
--
-- Auth is Google OAuth; NPCs live only in public.users with no email.
-- 1. users.email  → nullable (NPCs have no email)
-- 2. battle_log   → add FK constraints, remove *_is_npc columns
-- 3. army_missions → add origin_kingdom_id FK
-- 4. debris_fields → add UNIQUE(realm, region, slot)
-- 5. messages     → data TEXT→JSONB, add sender_id, add updated_at
-- ============================================================

BEGIN;

-- ── 1. users.email nullable ───────────────────────────────────────────────────

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- ── 2. battle_log ─────────────────────────────────────────────────────────────

ALTER TABLE battle_log
  ADD CONSTRAINT battle_log_attacker_fk
    FOREIGN KEY (attacker_kingdom_id) REFERENCES kingdoms(id) ON DELETE SET NULL,
  ADD CONSTRAINT battle_log_defender_fk
    FOREIGN KEY (defender_kingdom_id) REFERENCES kingdoms(id) ON DELETE SET NULL,
  DROP COLUMN attacker_is_npc,
  DROP COLUMN defender_is_npc;

-- ── 3. army_missions: origin_kingdom_id ──────────────────────────────────────

ALTER TABLE army_missions
  ADD COLUMN origin_kingdom_id uuid REFERENCES kingdoms(id) ON DELETE SET NULL;

-- Backfill from existing start coordinates
UPDATE army_missions am
SET origin_kingdom_id = k.id
FROM kingdoms k
WHERE k.realm  = am.start_realm
  AND k.region = am.start_region
  AND k.slot   = am.start_slot;

-- ── 4. debris_fields: UNIQUE coords ──────────────────────────────────────────

-- Collapse any duplicate rows (keep the one with most resources)
DELETE FROM debris_fields d
USING (
  SELECT realm, region, slot,
         MAX(wood + stone) AS best_total
  FROM debris_fields
  GROUP BY realm, region, slot
  HAVING COUNT(*) > 1
) dup
WHERE d.realm = dup.realm AND d.region = dup.region AND d.slot = dup.slot
  AND (d.wood + d.stone) < dup.best_total;

ALTER TABLE debris_fields
  ADD CONSTRAINT debris_fields_coords_key UNIQUE (realm, region, slot);

-- ── 5. messages: TEXT→JSONB, sender_id, updated_at ───────────────────────────

ALTER TABLE messages
  ADD COLUMN sender_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN updated_at timestamp NOT NULL DEFAULT now();

-- Convert data column from text to jsonb
-- Existing rows have valid JSON strings; cast directly
ALTER TABLE messages
  ALTER COLUMN data TYPE jsonb USING data::jsonb;

COMMIT;
