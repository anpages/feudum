-- OGame slot position production bonuses applied to wood and stone.
-- Inner slots (1-3): stone/quarry bonus (rocky terrain close to sun).
-- Middle slots (6-10): wood/sawmill bonus (dense forests, mineral belt).
-- Source: OGameX PlanetService::getProductionForPositionBonuses()

-- Wood (sawmill) bonus for middle slots 6-10
UPDATE "kingdoms" k
SET "wood_production" = (
  SELECT GREATEST(0, 30.0 * b.level * POWER(1.1::numeric, b.level) *
    CASE k.slot
      WHEN 6  THEN 1.17
      WHEN 7  THEN 1.23
      WHEN 8  THEN 1.35
      WHEN 9  THEN 1.23
      WHEN 10 THEN 1.17
    END)
  FROM "buildings" b
  WHERE b.kingdom_id = k.id AND b.type = 'sawmill'
  LIMIT 1
)
WHERE k.slot IN (6, 7, 8, 9, 10)
  AND EXISTS (
    SELECT 1 FROM "buildings" b WHERE b.kingdom_id = k.id AND b.type = 'sawmill'
  );

-- Stone (quarry) bonus for inner slots 1-3
UPDATE "kingdoms" k
SET "stone_production" = (
  SELECT GREATEST(0, 20.0 * b.level * POWER(1.1::numeric, b.level) *
    CASE k.slot
      WHEN 1 THEN 1.40
      WHEN 2 THEN 1.30
      WHEN 3 THEN 1.20
    END)
  FROM "buildings" b
  WHERE b.kingdom_id = k.id AND b.type = 'quarry'
  LIMIT 1
)
WHERE k.slot IN (1, 2, 3)
  AND EXISTS (
    SELECT 1 FROM "buildings" b WHERE b.kingdom_id = k.id AND b.type = 'quarry'
  );
