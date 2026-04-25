-- Add temperature columns to kingdoms.
-- tempMax is the warmer bound; tempMin = tempMax - 40 (same as OGame).
-- Cold slots (outer positions) produce more grain per the formula:
--   grain_production = 10 * lv * 1.1^lv * max(0.1, 1.44 - 0.004 * tempAvg)

ALTER TABLE "kingdoms" ADD COLUMN "temp_min" integer;
ALTER TABLE "kingdoms" ADD COLUMN "temp_max" integer;

-- Backfill using slot midpoints (no randomness — deterministic for existing kingdoms).
UPDATE "kingdoms" SET "temp_max" = CASE "slot"
  WHEN 1  THEN 240
  WHEN 2  THEN 190
  WHEN 3  THEN 140
  WHEN 4  THEN  90
  WHEN 5  THEN  80
  WHEN 6  THEN  70
  WHEN 7  THEN  60
  WHEN 8  THEN  50
  WHEN 9  THEN  40
  WHEN 10 THEN  30
  WHEN 11 THEN  20
  WHEN 12 THEN  10
  WHEN 13 THEN -30
  WHEN 14 THEN -70
  ELSE        -110  -- slot 15 and beyond
END;

UPDATE "kingdoms" SET "temp_min" = "temp_max" - 40;

-- Recalculate grain_production for all kingdoms that have a grainFarm.
-- Formula: 10 * lv * 1.1^lv * GREATEST(0.1, 1.44 - 0.004 * tempAvg)
UPDATE "kingdoms" k
SET "grain_production" = (
  SELECT GREATEST(0,
    10.0 * b.level
         * POWER(1.1, b.level)
         * GREATEST(0.1, 1.44 - 0.004 * ((k.temp_min::numeric + k.temp_max::numeric) / 2.0))
  )
  FROM "buildings" b
  WHERE b.kingdom_id = k.id AND b.type = 'grainFarm'
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM "buildings" b
  WHERE b.kingdom_id = k.id AND b.type = 'grainFarm' AND b.level > 0
);
