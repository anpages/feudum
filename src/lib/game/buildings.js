/**
 * Building definitions and formulas — derived from OGame reference (BuildingObjects.php, PlanetService.php)
 * OGame → Feudum mapping is in CLAUDE.md
 */

// ── Building catalog ──────────────────────────────────────────────────────────
// requires: array of { type: 'building'|'research', id, level }

export const BUILDINGS = [
  // ── Production ─────────────────────────────────────────────────────────────
  {
    id: 'sawmill',         // metal_mine
    woodBase: 60, stoneBase: 15, grainBase: 0, factor: 1.5,
    requires: [],
  },
  {
    id: 'quarry',          // crystal_mine
    woodBase: 48, stoneBase: 24, grainBase: 0, factor: 1.6,
    requires: [],
  },
  {
    id: 'grainFarm',       // deuterium_synthesizer
    woodBase: 225, stoneBase: 75, grainBase: 0, factor: 1.5,
    requires: [],
  },
  {
    id: 'windmill',        // solar_plant — produces energy
    woodBase: 75, stoneBase: 30, grainBase: 0, factor: 1.5,
    requires: [],
  },
  {
    id: 'cathedral',       // fusion_reactor — produces energy (requires alchemy research)
    woodBase: 900, stoneBase: 360, grainBase: 180, factor: 1.8,
    requires: [
      { type: 'building',  id: 'grainFarm', level: 5 },
      { type: 'research',  id: 'alchemy',   level: 3 },
    ],
  },

  // ── Storage ────────────────────────────────────────────────────────────────
  {
    id: 'granary',         // metal_store — increases wood capacity
    woodBase: 1000, stoneBase: 0, grainBase: 0, factor: 2.0,
    requires: [{ type: 'building', id: 'sawmill', level: 1 }],
  },
  {
    id: 'stonehouse',      // crystal_store — increases stone capacity
    woodBase: 1000, stoneBase: 500, grainBase: 0, factor: 2.0,
    requires: [{ type: 'building', id: 'quarry', level: 1 }],
  },
  {
    id: 'silo',            // deuterium_store — increases grain capacity
    woodBase: 1000, stoneBase: 1000, grainBase: 0, factor: 2.0,
    requires: [{ type: 'building', id: 'grainFarm', level: 1 }],
  },

  // ── Utility ────────────────────────────────────────────────────────────────
  {
    id: 'workshop',        // robot_factory — reduces build times
    woodBase: 400, stoneBase: 120, grainBase: 0, factor: 2.0,
    requires: [{ type: 'building', id: 'sawmill', level: 1 }],
  },
  {
    id: 'engineersGuild',  // nano_factory — exponential build time reduction
    woodBase: 1_000_000, stoneBase: 500_000, grainBase: 0, factor: 2.0,
    requires: [{ type: 'building', id: 'workshop', level: 10 }],
  },
  {
    id: 'barracks',        // shipyard — required for training units
    woodBase: 400, stoneBase: 200, grainBase: 0, factor: 2.0,
    requires: [{ type: 'building', id: 'sawmill', level: 1 }],
  },
  {
    id: 'academy',         // research_lab — required for research
    woodBase: 200, stoneBase: 400, grainBase: 0, factor: 2.0,
    requires: [{ type: 'building', id: 'sawmill', level: 1 }],
  },
  {
    id: 'alchemistTower',  // terraformer — increases building field_max (+5/lv + floor(lv/2))
    woodBase: 500, stoneBase: 1000, grainBase: 200, factor: 1.75,
    requires: [
      { type: 'building', id: 'academy', level: 4 },
      { type: 'building', id: 'quarry',  level: 4 },
    ],
  },
  {
    id: 'ambassadorHall',  // alliance_depot — shared resource storage (future alliance feature)
    woodBase: 200, stoneBase: 600, grainBase: 200, factor: 2.0,
    requires: [
      { type: 'building', id: 'academy',       level: 4 },
      { type: 'building', id: 'alchemistTower', level: 5 },
    ],
  },
  {
    id: 'armoury',         // missile_silo — unlocks advanced defenses
    woodBase: 200, stoneBase: 400, grainBase: 0, factor: 2.0,
    requires: [{ type: 'building', id: 'barracks', level: 2 }],
  },
]

// ── Cost formula: base * factor^level ────────────────────────────────────────

export function buildCost(woodBase, stoneBase, factor, level, grainBase = 0) {
  const f = Math.pow(factor, level)
  return {
    wood:  Math.floor(woodBase  * f),
    stone: Math.floor(stoneBase * f),
    grain: Math.floor(grainBase * f),
  }
}

// ── Build time (seconds) ──────────────────────────────────────────────────────
// (wood + stone) / (2500 * max(4 - nextLevel/2, 1) * (1 + workshop) * speed * 2^engineersGuild) * 3600
// Caller passes economy speed (server: cfg.economy_speed; client: from /api/season).

export function buildTime(wood, stone, nextLevel, workshopLevel, engineersGuildLevel, speed = 1) {
  const levelFactor = Math.max(4 - nextLevel / 2, 1)
  const divisor = 2500 * levelFactor * (1 + workshopLevel) * speed * Math.pow(2, engineersGuildLevel)
  return Math.max(1, Math.round(((wood + stone) / divisor) * 3600))
}

// ── Production formulas (per hour at given level) ────────────────────────────

export function woodProduction(level) {
  return level === 0 ? 0 : 30 * level * Math.pow(1.1, level)
}

export function stoneProduction(level) {
  return level === 0 ? 0 : 20 * level * Math.pow(1.1, level)
}

// ── Temperature (OGame slot ranges, medieval climate theme) ──────────────────
// Slot 1 = closest to sun (hottest), slot 15 = furthest (coldest).
// Cold slots produce more grain — same mechanic as OGame deuterium/slot.

export const SLOT_TEMP_RANGES = [
  null,           // index 0 unused
  [220, 260],     // slot 1  — Volcánico
  [170, 210],     // slot 2
  [120, 160],     // slot 3
  [70,  110],     // slot 4
  [60,  100],     // slot 5  — Cálido
  [50,   90],     // slot 6
  [40,   80],     // slot 7
  [30,   70],     // slot 8  — Templado
  [20,   60],     // slot 9
  [10,   50],     // slot 10
  [0,    40],     // slot 11 — Frío
  [-10,  30],     // slot 12
  [-50, -10],     // slot 13
  [-90, -50],     // slot 14 — Glacial
  [-130, -90],    // slot 15
]

/** Returns { tempMin, tempMax } for a kingdom at a given slot (with random variation). */
export function randomTempForSlot(slot) {
  const range = SLOT_TEMP_RANGES[slot] ?? [0, 40]
  const tempMax = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1))
  return { tempMax, tempMin: tempMax - 40 }
}

/** Returns integer average temperature. */
export function calcTempAvg(tempMin, tempMax) {
  return Math.round(((tempMin ?? 0) + (tempMax ?? 40)) / 2)
}

/**
 * Grain (deuterium) production including temperature factor.
 * tempAvg: average temperature for the slot (slot1=240°C, slot15=-110°C).
 * Cold slots produce significantly more grain — same as OGame deuterium/slot.
 */
export function grainProduction(level, tempAvg = 0) {
  if (level === 0) return 0
  const tempFactor = Math.max(0.1, 1.44 - 0.004 * tempAvg)
  return 10 * level * Math.pow(1.1, level) * tempFactor
}

// ── Energy formulas (per hour at given level) ─────────────────────────────────

/** Windmill (solar_plant): energy production */
export function windmillEnergy(level) {
  return level === 0 ? 0 : Math.floor(20 * level * Math.pow(1.1, level))
}

/** Cathedral (fusion_reactor): energy production; bonus scales with alchemy research */
export function cathedralEnergy(level, alchemyLevel = 0) {
  return level === 0 ? 0 : Math.floor(30 * level * Math.pow(1.05 + alchemyLevel * 0.01, level))
}

/** Sawmill energy consumption */
export function sawmillEnergy(level) {
  return level === 0 ? 0 : Math.floor(10 * level * Math.pow(1.1, level))
}

/** Quarry energy consumption */
export function quarryEnergy(level) {
  return level === 0 ? 0 : Math.floor(10 * level * Math.pow(1.1, level))
}

/** GrainFarm energy consumption */
export function grainFarmEnergy(level) {
  return level === 0 ? 0 : Math.floor(20 * level * Math.pow(1.1, level))
}

// Storage capacity: 5000 * floor(2.5 * exp(20 * level / 33)) — from OGame reference
export function storageCapacity(level) {
  if (level === 0) return 10_000
  return 5000 * Math.floor(2.5 * Math.exp((20 * level) / 33))
}

// ── Requirements check ────────────────────────────────────────────────────────

export function buildingRequirementsMet(def, kingdom, research) {
  for (const req of (def.requires ?? [])) {
    const actual = req.type === 'building'
      ? (kingdom[req.id] ?? 0)
      : (research[req.id] ?? 0)
    if (actual < req.level) return false
  }
  return true
}

// ── After completing a queue item: apply side-effects to kingdom ──────────────
// tempAvg required to compute correct grain production with temperature factor

export function applyBuildingEffect(building, newLevel, kingdom = {}) {
  const patch = { [building]: newLevel }
  const tempAvg = calcTempAvg(kingdom.tempMin, kingdom.tempMax)

  if (building === 'sawmill') {
    patch.woodProduction = woodProduction(newLevel)
  }
  if (building === 'quarry') {
    patch.stoneProduction = stoneProduction(newLevel)
  }
  if (building === 'grainFarm') {
    patch.grainProduction = grainProduction(newLevel, tempAvg)
  }
  if (building === 'granary')    patch.woodCapacity  = storageCapacity(newLevel)
  if (building === 'stonehouse') patch.stoneCapacity = storageCapacity(newLevel)
  if (building === 'silo')       patch.grainCapacity = storageCapacity(newLevel)

  return patch
}

// ── Building fields (slot limit) ─────────────────────────────────────────────
// Mirrors OGame Terraformer: BASE + 5*level + floor(level/2)

export const BASE_FIELDS = 163

export function calcFieldMax(alchemistTowerLevel = 0) {
  const lv = alchemistTowerLevel ?? 0
  return BASE_FIELDS + 5 * lv + Math.floor(lv / 2)
}

export function calcFieldsUsed(kingdom) {
  return BUILDINGS.reduce((sum, b) => sum + (kingdom[b.id] ?? 0), 0)
}
