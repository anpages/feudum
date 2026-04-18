ALTER TABLE "kingdoms"
  ADD COLUMN IF NOT EXISTS "temp_avg"           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sawmill_percent"    integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "quarry_percent"     integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "grain_farm_percent" integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "windmill_percent"   integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "cathedral_percent"  integer NOT NULL DEFAULT 10;

UPDATE "kingdoms" SET "temp_avg" = 240 - (slot - 1) * 25;

UPDATE "kingdoms"
  SET grain_production = CASE
    WHEN grain_farm = 0 THEN 0
    ELSE GREATEST(0, 10.0 * grain_farm * POWER(1.1, grain_farm) * GREATEST(0.1, 1.44 - 0.004 * (240 - (slot - 1) * 25)))
  END;
