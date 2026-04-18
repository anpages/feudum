ALTER TABLE "kingdoms"
  ADD COLUMN IF NOT EXISTS "terrain" varchar(20) NOT NULL DEFAULT 'balanced';

-- Assign deterministic terrain to all existing kingdoms using the same formula as terrain.js
UPDATE "kingdoms" SET "terrain" = CASE
  WHEN ABS((realm * 7901 + region * 97 + slot * 37 + realm * region * slot) % 100) < 35 THEN 'forest'
  WHEN ABS((realm * 7901 + region * 97 + slot * 37 + realm * region * slot) % 100) < 70 THEN 'mountain'
  WHEN ABS((realm * 7901 + region * 97 + slot * 37 + realm * region * slot) % 100) < 95 THEN 'plains'
  ELSE 'balanced'
END;
