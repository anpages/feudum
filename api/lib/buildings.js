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
    id: 'windmill',        // solar_plant
    woodBase: 75, stoneBase: 30, grainBase: 0, factor: 1.5,
    requires: [],
  },
  {
    id: 'cathedral',       // fusion_reactor — bonus grain production
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
    requires: [],
  },
  {
    id: 'stonehouse',      // crystal_store — increases stone capacity
    woodBase: 1000, stoneBase: 500, grainBase: 0, factor: 2.0,
    requires: [],
  },
  {
    id: 'silo',            // deuterium_store — increases grain capacity
    woodBase: 1000, stoneBase: 1000, grainBase: 0, factor: 2.0,
    requires: [],
  },

  // ── Utility ────────────────────────────────────────────────────────────────
  {
    id: 'workshop',        // robot_factory — reduces build times
    woodBase: 400, stoneBase: 120, grainBase: 0, factor: 2.0,
    requires: [],
  },
  {
    id: 'engineersGuild',  // nano_factory — exponential build time reduction
    woodBase: 1_000_000, stoneBase: 500_000, grainBase: 0, factor: 2.0,
    requires: [{ type: 'building', id: 'workshop', level: 10 }],
  },
  {
    id: 'barracks',        // shipyard — required for training units
    woodBase: 400, stoneBase: 200, grainBase: 0, factor: 2.0,
    requires: [],
  },
  {
    id: 'academy',         // research_lab — required for research
    woodBase: 200, stoneBase: 400, grainBase: 0, factor: 2.0,
    requires: [],
  },
  {
    id: 'alchemistTower',  // bonus stone production + research speed multiplier
    woodBase: 500, stoneBase: 1000, grainBase: 200, factor: 1.75,
    requires: [
      { type: 'building', id: 'academy', level: 4 },
      { type: 'building', id: 'quarry',  level: 4 },
    ],
  },
  {
    id: 'ambassadorHall',  // alliance_depot equivalent — reduces travel time (future)
    woodBase: 200, stoneBase: 600, grainBase: 200, factor: 2.0,
    requires: [
      { type: 'building', id: 'academy',       level: 4 },
      { type: 'building', id: 'alchemistTower',level: 5 },
    ],
  },
  {
    id: 'armoury',         // missile_silo equivalent — unlocks advanced defenses
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

export function grainProduction(level) {
  return level === 0 ? 0 : 10 * level * Math.pow(1.1, level)
}

export function cathedralProduction(level) {
  return level === 0 ? 0 : 5 * level * Math.pow(1.1, level)
}

export function alchemistProduction(level) {
  return level === 0 ? 0 : 15 * level * Math.pow(1.1, level)
}

export function populationMax(windmillLevel) {
  return windmillLevel === 0 ? 0 : Math.floor(20 * windmillLevel * Math.pow(1.1, windmillLevel))
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

export function applyBuildingEffect(building, newLevel, kingdom = {}) {
  const patch = { [building]: newLevel }

  // Production recalculated including sibling bonuses
  const grainFarmLv    = building === 'grainFarm'      ? newLevel : (kingdom.grainFarm      ?? 0)
  const cathedralLv    = building === 'cathedral'      ? newLevel : (kingdom.cathedral      ?? 0)
  const quarryLv       = building === 'quarry'         ? newLevel : (kingdom.quarry         ?? 0)
  const alchemistLv    = building === 'alchemistTower' ? newLevel : (kingdom.alchemistTower ?? 0)

  if (building === 'sawmill')        patch.woodProduction  = woodProduction(newLevel)
  if (building === 'quarry' || building === 'alchemistTower') {
    patch.stoneProduction = stoneProduction(quarryLv) + alchemistProduction(alchemistLv)
  }
  if (building === 'grainFarm' || building === 'cathedral') {
    patch.grainProduction = grainProduction(grainFarmLv) + cathedralProduction(cathedralLv)
  }
  if (building === 'windmill')       patch.populationMax   = populationMax(newLevel)
  if (building === 'granary')        patch.woodCapacity    = storageCapacity(newLevel)
  if (building === 'stonehouse')     patch.stoneCapacity   = storageCapacity(newLevel)
  if (building === 'silo')           patch.grainCapacity   = storageCapacity(newLevel)

  return patch
}
