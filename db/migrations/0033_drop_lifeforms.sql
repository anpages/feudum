-- Drop lifeforms queue tables
DROP TABLE IF EXISTS lf_research_queue CASCADE;
DROP TABLE IF EXISTS lf_building_queue CASCADE;

-- Drop lifeforms columns from kingdoms
ALTER TABLE kingdoms
  DROP COLUMN IF EXISTS civilization,
  DROP COLUMN IF EXISTS civ_level_romans,
  DROP COLUMN IF EXISTS civ_level_vikings,
  DROP COLUMN IF EXISTS civ_level_byzantines,
  DROP COLUMN IF EXISTS civ_level_saracens,
  DROP COLUMN IF EXISTS population_t1,
  DROP COLUMN IF EXISTS population_t2,
  DROP COLUMN IF EXISTS population_t3,
  DROP COLUMN IF EXISTS food_stored,
  DROP COLUMN IF EXISTS food_last_update,
  DROP COLUMN IF EXISTS artifacts,
  DROP COLUMN IF EXISTS lf_buildings,
  DROP COLUMN IF EXISTS lf_research;
