/**
 * Unit & defense catalog — derived from OGame MilitaryShipObjects.php,
 * CivilShipObjects.php, DefenseObjects.php + PlanetService.getUnitConstructionTime()
 *
 * Build time formula (per unit):
 *   time_hours = hull / (2500 * (1 + barracks) * speed * 2^engineersGuild)
 *   time_seconds = max(1, round(time_hours * 3600)) * amount
 *
 * Requirements reference: building keys from kingdoms, research keys from research.
 */

// ── Military units ────────────────────────────────────────────────────────────

export const UNITS = [
  {
    id: 'squire',       // light_fighter
    woodBase: 3000, stoneBase: 1000, grainBase: 0,
    hull: 4000,  shield: 10,  attack: 50,
    requires: [
      { type: 'building',  id: 'barracks',     level: 1 },
      { type: 'research',  id: 'horsemanship', level: 1 },
    ],
  },
  {
    id: 'knight',       // heavy_fighter
    woodBase: 6000, stoneBase: 4000, grainBase: 0,
    hull: 10000, shield: 25,  attack: 150,
    requires: [
      { type: 'building',  id: 'barracks',      level: 3 },
      { type: 'research',  id: 'fortification', level: 2 },
      { type: 'research',  id: 'cartography',   level: 2 },
    ],
  },
  {
    id: 'paladin',      // cruiser
    woodBase: 20000, stoneBase: 7000, grainBase: 2000,
    hull: 27000, shield: 50,  attack: 400,
    requires: [
      { type: 'building',  id: 'barracks',    level: 5 },
      { type: 'research',  id: 'cartography', level: 4 },
      { type: 'research',  id: 'runemastery', level: 2 },
    ],
  },
  {
    id: 'warlord',      // battle_ship
    woodBase: 45000, stoneBase: 15000, grainBase: 0,
    hull: 60000, shield: 200, attack: 1000,
    requires: [
      { type: 'building',  id: 'barracks',     level: 7 },
      { type: 'research',  id: 'tradeRoutes',  level: 4 },
    ],
  },
  {
    id: 'grandKnight',  // battlecruiser
    woodBase: 30000, stoneBase: 40000, grainBase: 15000,
    hull: 70000, shield: 400, attack: 700,
    requires: [
      { type: 'building',  id: 'barracks',     level: 8 },
      { type: 'research',  id: 'tradeRoutes',  level: 5 },
      { type: 'research',  id: 'mysticism',    level: 5 },
      { type: 'research',  id: 'pyromancy',    level: 12 },
    ],
  },
  {
    id: 'siegeMaster',  // bomber
    woodBase: 50000, stoneBase: 25000, grainBase: 15000,
    hull: 75000, shield: 500, attack: 1000,
    requires: [
      { type: 'building',  id: 'barracks',    level: 8 },
      { type: 'research',  id: 'cartography', level: 6 },
      { type: 'research',  id: 'dragonlore',  level: 5 },
    ],
  },
  {
    id: 'warMachine',   // destroyer
    woodBase: 60000, stoneBase: 50000, grainBase: 15000,
    hull: 110000, shield: 500, attack: 2000,
    requires: [
      { type: 'building',  id: 'barracks',    level: 9 },
      { type: 'research',  id: 'tradeRoutes', level: 6 },
      { type: 'research',  id: 'mysticism',   level: 5 },
    ],
  },
  {
    id: 'dragonKnight', // deathstar
    woodBase: 5000000, stoneBase: 4000000, grainBase: 1000000,
    hull: 9000000, shield: 50000, attack: 200000,
    requires: [
      { type: 'building',  id: 'barracks',       level: 12 },
      { type: 'research',  id: 'tradeRoutes',    level: 7 },
      { type: 'research',  id: 'mysticism',      level: 6 },
      { type: 'research',  id: 'divineBlessing', level: 1 },
    ],
  },
]

// ── Support units ─────────────────────────────────────────────────────────────

export const SUPPORT_UNITS = [
  {
    id: 'merchant',     // small_cargo
    woodBase: 2000, stoneBase: 2000, grainBase: 0,
    hull: 4000,  shield: 10,  attack: 5,
    requires: [
      { type: 'building',  id: 'barracks',     level: 1 },
      { type: 'research',  id: 'horsemanship', level: 2 },
    ],
  },
  {
    id: 'scout',        // espionage_probe
    woodBase: 0, stoneBase: 1000, grainBase: 0,
    hull: 1000, shield: 0, attack: 0,
    requires: [
      { type: 'building',  id: 'barracks', level: 3 },
      { type: 'research',  id: 'spycraft', level: 2 },
    ],
  },
  {
    id: 'colonist',     // colony_ship
    woodBase: 10000, stoneBase: 20000, grainBase: 10000,
    hull: 30000, shield: 100, attack: 50,
    requires: [
      { type: 'building',  id: 'barracks',    level: 4 },
      { type: 'research',  id: 'cartography', level: 3 },
    ],
  },
  {
    id: 'caravan',      // large_cargo
    woodBase: 6000, stoneBase: 6000, grainBase: 0,
    hull: 12000, shield: 25,  attack: 5,
    requires: [
      { type: 'building',  id: 'barracks',     level: 4 },
      { type: 'research',  id: 'horsemanship', level: 6 },
    ],
  },
  {
    id: 'scavenger',    // recycler
    woodBase: 10000, stoneBase: 6000, grainBase: 2000,
    hull: 16000, shield: 10,  attack: 1,
    requires: [
      { type: 'building',  id: 'barracks',     level: 4 },
      { type: 'research',  id: 'horsemanship', level: 6 },
      { type: 'research',  id: 'runemastery',  level: 2 },
    ],
  },
]

// ── Defenses ──────────────────────────────────────────────────────────────────

export const DEFENSES = [
  {
    id: 'beacon',       // solar satellite — watchtower, cheap passive defense
    woodBase: 1000, stoneBase: 0, grainBase: 0,
    hull: 500, shield: 1, attack: 10,
    requires: [
      { type: 'building', id: 'barracks', level: 1 },
    ],
  },
  {
    id: 'archer',       // rocket_launcher
    woodBase: 2000, stoneBase: 0, grainBase: 0,
    hull: 2000,   shield: 20,   attack: 80,
    requires: [{ type: 'building', id: 'barracks', level: 1 }],
  },
  {
    id: 'palisade',     // small_shield_dome
    woodBase: 10000, stoneBase: 10000, grainBase: 0,
    hull: 20000,  shield: 2000, attack: 1,
    requires: [
      { type: 'building',  id: 'barracks', level: 1 },
      { type: 'research',  id: 'armoury',  level: 2 },
    ],
  },
  {
    id: 'crossbowman',  // light_laser
    woodBase: 1500, stoneBase: 500, grainBase: 0,
    hull: 2000,   shield: 25,   attack: 100,
    requires: [
      { type: 'building',  id: 'barracks',  level: 2 },
      { type: 'research',  id: 'pyromancy', level: 3 },
    ],
  },
  {
    id: 'moat',         // anti-ballistic missile — passive ditch defense
    woodBase: 5000, stoneBase: 2000, grainBase: 0,
    hull: 15000, shield: 500, attack: 50,
    requires: [
      { type: 'building', id: 'barracks', level: 3 },
      { type: 'building', id: 'armoury',  level: 1 },
    ],
  },
  {
    id: 'ballista',     // heavy_laser
    woodBase: 6000, stoneBase: 2000, grainBase: 0,
    hull: 8000,   shield: 100,  attack: 250,
    requires: [
      { type: 'building',  id: 'barracks',  level: 4 },
      { type: 'research',  id: 'pyromancy', level: 6 },
      { type: 'research',  id: 'alchemy',   level: 3 },
    ],
  },
  {
    id: 'mageTower',    // ion_cannon
    woodBase: 2000, stoneBase: 6000, grainBase: 0,
    hull: 8000,   shield: 500,  attack: 150,
    requires: [
      { type: 'building',  id: 'barracks',    level: 4 },
      { type: 'research',  id: 'runemastery', level: 4 },
    ],
  },
  {
    id: 'catapult',     // interplanetary missile — heavy siege weapon
    woodBase: 12000, stoneBase: 3000, grainBase: 1000,
    hull: 50000, shield: 500, attack: 750,
    requires: [
      { type: 'building', id: 'barracks',    level: 4 },
      { type: 'building', id: 'armoury',     level: 2 },
      { type: 'research', id: 'swordsmanship', level: 2 },
    ],
  },
  {
    id: 'trebuchet',    // gauss_cannon
    woodBase: 20000, stoneBase: 15000, grainBase: 2000,
    hull: 35000,  shield: 200,  attack: 1100,
    requires: [
      { type: 'building',  id: 'barracks',       level: 6 },
      { type: 'research',  id: 'swordsmanship',  level: 3 },
      { type: 'research',  id: 'armoury',        level: 1 },
      { type: 'research',  id: 'alchemy',        level: 6 },
    ],
  },
  {
    id: 'castleWall',   // large_shield_dome
    woodBase: 50000, stoneBase: 50000, grainBase: 0,
    hull: 100000, shield: 10000, attack: 1,
    requires: [
      { type: 'building',  id: 'barracks', level: 6 },
      { type: 'research',  id: 'armoury',  level: 6 },
    ],
  },
  {
    id: 'dragonCannon', // plasma_turret
    woodBase: 50000, stoneBase: 50000, grainBase: 30000,
    hull: 100000, shield: 300,  attack: 3000,
    requires: [
      { type: 'building',  id: 'barracks',   level: 8 },
      { type: 'research',  id: 'dragonlore', level: 7 },
    ],
  },
]

// ── Missiles ──────────────────────────────────────────────────────────────────
// Launchable one-way projectiles stored in armoury. Not troops — consumed on launch.
export const MISSILES = [
  {
    id: 'ballistic',   // interplanetary_missile
    woodBase: 8000, stoneBase: 2000, grainBase: 0,
    hull: 4000,   shield: 0, attack: 0,  // hull used only for build time
    requires: [
      { type: 'building',  id: 'armoury',    level: 2 },
      { type: 'research',  id: 'cartography', level: 1 },
    ],
  },
]

// All units catalog (for lookup)
export const ALL_UNITS = [...UNITS, ...SUPPORT_UNITS, ...DEFENSES, ...MISSILES]

// ── Build time per unit ───────────────────────────────────────────────────────
// From PlanetService.getUnitConstructionTime():
//   time_hours = hull / (2500 * (1 + barracks) * speed * 2^engineersGuild)

export function unitBuildTime(hull, barracksLevel, engineersGuildLevel, amount, speed = 1) {
  const divisor    = 2500 * (1 + barracksLevel) * speed * Math.pow(2, engineersGuildLevel)
  const perUnit    = Math.max(1, Math.round((hull / divisor) * 3600))
  return perUnit * amount
}

// ── Requirements check ────────────────────────────────────────────────────────

export function unitRequirementsMet(def, kingdom, research) {
  for (const req of def.requires) {
    const actual = req.type === 'building' ? (kingdom[req.id] ?? 0) : (research[req.id] ?? 0)
    if (actual < req.level) return false
  }
  return true
}
