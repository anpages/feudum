-- ============================================================
-- Migration 0038: Normalize schema
--
-- Problems fixed:
--   1. kingdoms had 40+ columns for buildings/units (monolithic)
--   2. research had 16 type columns in one wide row (monolithic)
--   3. npc_research was a duplicate table for the same concept
--   4. army_missions had 14 unit columns instead of JSONB
--   5. users had is_npc/is_admin booleans instead of a role enum
--   6. All NPCs shared one system user_id; now each NPC is its own user
--
-- After this migration:
--   buildings(kingdom_id, type, level)    — one row per building type
--   units(kingdom_id, type, quantity)     — one row per unit type
--   research(user_id, type, level)        — one row per research type, unified
--   army_missions.units JSONB             — {squire:10, knight:5, ...}
--   users.role ENUM ('human','npc','admin')
-- ============================================================

BEGIN;

-- ── 1. user_role enum + role column ───────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('human', 'npc', 'admin');

ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'human';
UPDATE users SET role = 'admin' WHERE is_admin = true;
UPDATE users SET role = 'npc'   WHERE is_npc   = true AND is_admin = false;

-- ── 2. buildings table ────────────────────────────────────────────────────────

CREATE TABLE buildings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  kingdom_id uuid        NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  type       varchar(50) NOT NULL,
  level      integer     NOT NULL DEFAULT 0,
  created_at timestamp   NOT NULL DEFAULT now(),
  updated_at timestamp   NOT NULL DEFAULT now(),
  UNIQUE (kingdom_id, type)
);

-- Migrate from embedded columns (type values match JS camelCase API keys)
INSERT INTO buildings (kingdom_id, type, level)
SELECT id, 'sawmill',        sawmill        FROM kingdoms WHERE sawmill        > 0
UNION ALL SELECT id, 'quarry',         quarry         FROM kingdoms WHERE quarry         > 0
UNION ALL SELECT id, 'grainFarm',      grain_farm     FROM kingdoms WHERE grain_farm     > 0
UNION ALL SELECT id, 'windmill',       windmill       FROM kingdoms WHERE windmill       > 0
UNION ALL SELECT id, 'cathedral',      cathedral      FROM kingdoms WHERE cathedral      > 0
UNION ALL SELECT id, 'workshop',       workshop       FROM kingdoms WHERE workshop       > 0
UNION ALL SELECT id, 'engineersGuild', engineers_guild FROM kingdoms WHERE engineers_guild > 0
UNION ALL SELECT id, 'barracks',       barracks       FROM kingdoms WHERE barracks       > 0
UNION ALL SELECT id, 'granary',        granary        FROM kingdoms WHERE granary        > 0
UNION ALL SELECT id, 'stonehouse',     stonehouse     FROM kingdoms WHERE stonehouse     > 0
UNION ALL SELECT id, 'silo',           silo           FROM kingdoms WHERE silo           > 0
UNION ALL SELECT id, 'academy',        academy        FROM kingdoms WHERE academy        > 0
UNION ALL SELECT id, 'alchemistTower', alchemist_tower FROM kingdoms WHERE alchemist_tower > 0
UNION ALL SELECT id, 'ambassadorHall', ambassador_hall FROM kingdoms WHERE ambassador_hall > 0
UNION ALL SELECT id, 'armoury',        armoury        FROM kingdoms WHERE armoury        > 0
;

-- ── 3. units table ────────────────────────────────────────────────────────────

CREATE TABLE units (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  kingdom_id uuid        NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  type       varchar(50) NOT NULL,
  quantity   integer     NOT NULL DEFAULT 0,
  created_at timestamp   NOT NULL DEFAULT now(),
  updated_at timestamp   NOT NULL DEFAULT now(),
  UNIQUE (kingdom_id, type)
);

-- Mobile units
INSERT INTO units (kingdom_id, type, quantity)
SELECT id, 'squire',      squire      FROM kingdoms WHERE squire      > 0
UNION ALL SELECT id, 'knight',      knight      FROM kingdoms WHERE knight      > 0
UNION ALL SELECT id, 'paladin',     paladin     FROM kingdoms WHERE paladin     > 0
UNION ALL SELECT id, 'warlord',     warlord     FROM kingdoms WHERE warlord     > 0
UNION ALL SELECT id, 'grandKnight', grand_knight FROM kingdoms WHERE grand_knight > 0
UNION ALL SELECT id, 'siegeMaster', siege_master FROM kingdoms WHERE siege_master > 0
UNION ALL SELECT id, 'warMachine',  war_machine  FROM kingdoms WHERE war_machine  > 0
UNION ALL SELECT id, 'dragonKnight',dragon_knight FROM kingdoms WHERE dragon_knight > 0
UNION ALL SELECT id, 'merchant',    merchant    FROM kingdoms WHERE merchant    > 0
UNION ALL SELECT id, 'caravan',     caravan     FROM kingdoms WHERE caravan     > 0
UNION ALL SELECT id, 'colonist',    colonist    FROM kingdoms WHERE colonist    > 0
UNION ALL SELECT id, 'scavenger',   scavenger   FROM kingdoms WHERE scavenger   > 0
UNION ALL SELECT id, 'scout',       scout       FROM kingdoms WHERE scout       > 0
UNION ALL SELECT id, 'beacon',      beacon      FROM kingdoms WHERE beacon      > 0
UNION ALL SELECT id, 'ballistic',   ballistic   FROM kingdoms WHERE ballistic   > 0
-- Defenses
UNION ALL SELECT id, 'archer',      archer      FROM kingdoms WHERE archer      > 0
UNION ALL SELECT id, 'crossbowman', crossbowman FROM kingdoms WHERE crossbowman > 0
UNION ALL SELECT id, 'ballista',    ballista    FROM kingdoms WHERE ballista    > 0
UNION ALL SELECT id, 'trebuchet',   trebuchet   FROM kingdoms WHERE trebuchet   > 0
UNION ALL SELECT id, 'mageTower',   mage_tower  FROM kingdoms WHERE mage_tower  > 0
UNION ALL SELECT id, 'dragonCannon',dragon_cannon FROM kingdoms WHERE dragon_cannon > 0
UNION ALL SELECT id, 'palisade',    palisade    FROM kingdoms WHERE palisade    > 0
UNION ALL SELECT id, 'castleWall',  castle_wall FROM kingdoms WHERE castle_wall > 0
UNION ALL SELECT id, 'moat',        moat        FROM kingdoms WHERE moat        > 0
UNION ALL SELECT id, 'catapult',    catapult    FROM kingdoms WHERE catapult    > 0
;

-- ── 4. Unified research table ─────────────────────────────────────────────────
--
-- Each NPC kingdom needs its own user row so research can be keyed by user_id.
-- We create individual NPC users and reassign kingdoms before creating the table.

-- Temp mapping: kingdom_id → new NPC user_id
CREATE TEMP TABLE npc_user_map AS
SELECT id AS kingdom_id, gen_random_uuid() AS new_user_id
FROM kingdoms
WHERE is_npc = true;

-- Insert one user row per NPC kingdom
INSERT INTO users (id, email, role, created_at, updated_at)
SELECT m.new_user_id,
       'npc-' || m.kingdom_id || '@feudum.internal',
       'npc',
       now(), now()
FROM npc_user_map m;

-- Reassign each NPC kingdom to its own user
UPDATE kingdoms k
SET user_id = m.new_user_id
FROM npc_user_map m
WHERE k.id = m.kingdom_id;

-- Also update army_missions that were sent by an NPC — match by start coordinate
UPDATE army_missions am
SET user_id = k.user_id
FROM kingdoms k
WHERE k.realm  = am.start_realm
  AND k.region = am.start_region
  AND k.slot   = am.start_slot
  AND k.is_npc = true;

-- Rename old wide research table
ALTER TABLE research RENAME TO research_v1;

CREATE TABLE research (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       varchar(50) NOT NULL,
  level      integer     NOT NULL DEFAULT 0,
  created_at timestamp   NOT NULL DEFAULT now(),
  updated_at timestamp   NOT NULL DEFAULT now(),
  UNIQUE (user_id, type)
);

-- Migrate human research (wide → long)
INSERT INTO research (user_id, type, level, created_at, updated_at)
SELECT user_id, 'swordsmanship',     swordsmanship,      created_at, updated_at FROM research_v1 WHERE swordsmanship      > 0
UNION ALL SELECT user_id, 'armoury',           armoury,            created_at, updated_at FROM research_v1 WHERE armoury            > 0
UNION ALL SELECT user_id, 'fortification',     fortification,      created_at, updated_at FROM research_v1 WHERE fortification      > 0
UNION ALL SELECT user_id, 'horsemanship',      horsemanship,       created_at, updated_at FROM research_v1 WHERE horsemanship       > 0
UNION ALL SELECT user_id, 'cartography',       cartography,        created_at, updated_at FROM research_v1 WHERE cartography        > 0
UNION ALL SELECT user_id, 'tradeRoutes',       trade_routes,       created_at, updated_at FROM research_v1 WHERE trade_routes       > 0
UNION ALL SELECT user_id, 'alchemy',           alchemy,            created_at, updated_at FROM research_v1 WHERE alchemy            > 0
UNION ALL SELECT user_id, 'pyromancy',         pyromancy,          created_at, updated_at FROM research_v1 WHERE pyromancy          > 0
UNION ALL SELECT user_id, 'runemastery',       runemastery,        created_at, updated_at FROM research_v1 WHERE runemastery        > 0
UNION ALL SELECT user_id, 'mysticism',         mysticism,          created_at, updated_at FROM research_v1 WHERE mysticism          > 0
UNION ALL SELECT user_id, 'dragonlore',        dragonlore,         created_at, updated_at FROM research_v1 WHERE dragonlore         > 0
UNION ALL SELECT user_id, 'spycraft',          spycraft,           created_at, updated_at FROM research_v1 WHERE spycraft           > 0
UNION ALL SELECT user_id, 'logistics',         logistics,          created_at, updated_at FROM research_v1 WHERE logistics          > 0
UNION ALL SELECT user_id, 'exploration',       exploration,        created_at, updated_at FROM research_v1 WHERE exploration        > 0
UNION ALL SELECT user_id, 'diplomaticNetwork', diplomatic_network, created_at, updated_at FROM research_v1 WHERE diplomatic_network > 0
UNION ALL SELECT user_id, 'divineBlessing',    divine_blessing,    created_at, updated_at FROM research_v1 WHERE divine_blessing    > 0
;

-- Migrate NPC research (npc_research keyed by kingdom_id → new per-NPC user_id)
INSERT INTO research (user_id, type, level, created_at, updated_at)
SELECT m.new_user_id, 'swordsmanship', nr.swordsmanship, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.swordsmanship > 0
UNION ALL
SELECT m.new_user_id, 'armoury', nr.armoury, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.armoury > 0
UNION ALL
SELECT m.new_user_id, 'fortification', nr.fortification, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.fortification > 0
UNION ALL
SELECT m.new_user_id, 'horsemanship', nr.horsemanship, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.horsemanship > 0
UNION ALL
SELECT m.new_user_id, 'cartography', nr.cartography, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.cartography > 0
UNION ALL
SELECT m.new_user_id, 'tradeRoutes', nr.trade_routes, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.trade_routes > 0
UNION ALL
SELECT m.new_user_id, 'alchemy', nr.alchemy, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.alchemy > 0
UNION ALL
SELECT m.new_user_id, 'pyromancy', nr.pyromancy, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.pyromancy > 0
UNION ALL
SELECT m.new_user_id, 'runemastery', nr.runemastery, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.runemastery > 0
UNION ALL
SELECT m.new_user_id, 'mysticism', nr.mysticism, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.mysticism > 0
UNION ALL
SELECT m.new_user_id, 'dragonlore', nr.dragonlore, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.dragonlore > 0
UNION ALL
SELECT m.new_user_id, 'spycraft', nr.spycraft, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.spycraft > 0
UNION ALL
SELECT m.new_user_id, 'logistics', nr.logistics, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.logistics > 0
UNION ALL
SELECT m.new_user_id, 'exploration', nr.exploration, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.exploration > 0
UNION ALL
SELECT m.new_user_id, 'diplomaticNetwork', nr.diplomatic_network, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.diplomatic_network > 0
UNION ALL
SELECT m.new_user_id, 'divineBlessing', nr.divine_blessing, now(), now()
FROM npc_research nr JOIN npc_user_map m ON m.kingdom_id = nr.kingdom_id WHERE nr.divine_blessing > 0
;

-- ── 5. Queue column renames ───────────────────────────────────────────────────

ALTER TABLE building_queue  RENAME COLUMN building  TO building_type;
ALTER TABLE research_queue  RENAME COLUMN research   TO research_type;
ALTER TABLE unit_queue      RENAME COLUMN unit       TO unit_type;

-- research_queue.user_id: update any NPC kingdom entries to new user_ids
UPDATE research_queue rq
SET user_id = k.user_id
FROM kingdoms k
WHERE rq.kingdom_id = k.id
  AND rq.user_id != k.user_id;

-- ── 6. army_missions: replace unit columns with JSONB ─────────────────────────

ALTER TABLE army_missions ADD COLUMN units jsonb NOT NULL DEFAULT '{}';

UPDATE army_missions SET units = jsonb_strip_nulls(jsonb_build_object(
  'squire',       NULLIF(squire,        0),
  'knight',       NULLIF(knight,        0),
  'paladin',      NULLIF(paladin,       0),
  'warlord',      NULLIF(warlord,       0),
  'grandKnight',  NULLIF(grand_knight,  0),
  'siegeMaster',  NULLIF(siege_master,  0),
  'warMachine',   NULLIF(war_machine,   0),
  'dragonKnight', NULLIF(dragon_knight, 0),
  'merchant',     NULLIF(merchant,      0),
  'caravan',      NULLIF(caravan,       0),
  'colonist',     NULLIF(colonist,      0),
  'scavenger',    NULLIF(scavenger,     0),
  'scout',        NULLIF(scout,         0),
  'ballistic',    NULLIF(ballistic,     0)
));

ALTER TABLE army_missions
  DROP COLUMN squire,
  DROP COLUMN knight,
  DROP COLUMN paladin,
  DROP COLUMN warlord,
  DROP COLUMN grand_knight,
  DROP COLUMN siege_master,
  DROP COLUMN war_machine,
  DROP COLUMN dragon_knight,
  DROP COLUMN merchant,
  DROP COLUMN caravan,
  DROP COLUMN colonist,
  DROP COLUMN scavenger,
  DROP COLUMN scout,
  DROP COLUMN ballistic;

-- ── 7. Drop building + unit columns from kingdoms ─────────────────────────────

ALTER TABLE kingdoms
  DROP COLUMN sawmill,
  DROP COLUMN quarry,
  DROP COLUMN grain_farm,
  DROP COLUMN windmill,
  DROP COLUMN cathedral,
  DROP COLUMN workshop,
  DROP COLUMN engineers_guild,
  DROP COLUMN barracks,
  DROP COLUMN granary,
  DROP COLUMN stonehouse,
  DROP COLUMN silo,
  DROP COLUMN academy,
  DROP COLUMN alchemist_tower,
  DROP COLUMN ambassador_hall,
  DROP COLUMN armoury,
  DROP COLUMN squire,
  DROP COLUMN knight,
  DROP COLUMN paladin,
  DROP COLUMN warlord,
  DROP COLUMN grand_knight,
  DROP COLUMN siege_master,
  DROP COLUMN war_machine,
  DROP COLUMN dragon_knight,
  DROP COLUMN merchant,
  DROP COLUMN caravan,
  DROP COLUMN colonist,
  DROP COLUMN scavenger,
  DROP COLUMN scout,
  DROP COLUMN beacon,
  DROP COLUMN archer,
  DROP COLUMN crossbowman,
  DROP COLUMN ballista,
  DROP COLUMN trebuchet,
  DROP COLUMN mage_tower,
  DROP COLUMN dragon_cannon,
  DROP COLUMN palisade,
  DROP COLUMN castle_wall,
  DROP COLUMN moat,
  DROP COLUMN catapult,
  DROP COLUMN ballistic;

-- ── 8. Drop is_admin / is_npc from users ──────────────────────────────────────
-- The public_profiles view depends on is_admin — recreate it using role

DROP VIEW IF EXISTS public_profiles;

ALTER TABLE users
  DROP COLUMN is_admin,
  DROP COLUMN is_npc;

CREATE OR REPLACE VIEW public_profiles AS
  SELECT id, username, character_class,
         (role = 'admin') AS is_admin,
         role, created_at
  FROM users;

-- ── 9. Drop obsolete tables ───────────────────────────────────────────────────

DROP TABLE research_v1;
DROP TABLE npc_research;

COMMIT;
