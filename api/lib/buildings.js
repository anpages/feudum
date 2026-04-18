/**
 * Building definitions and formulas — derived from OGame reference (BuildingObjects.php, PlanetService.php)
 * OGame → Feudum mapping is in CLAUDE.md
 */

// ── Building catalog ──────────────────────────────────────────────────────────

export const BUILDINGS = [
  {
    id: 'sawmill',         // metal_mine
    woodBase: 60, stoneBase: 15, factor: 1.5,
  },
  {
    id: 'quarry',          // crystal_mine
    woodBase: 48, stoneBase: 24, factor: 1.6,
  },
  {
    id: 'grainFarm',       // deuterium_synthesizer (no temperature factor in medieval)
    woodBase: 225, stoneBase: 75, factor: 1.5,
  },
  {
    id: 'windmill',        // solar_plant
    woodBase: 75, stoneBase: 30, factor: 1.5,
  },
  {
    id: 'workshop',        // robot_factory — reduces build times via (1 + workshop)
    woodBase: 400, stoneBase: 120, factor: 2.0,
  },
  {
    id: 'engineersGuild',  // nano_factory — exponential build time reduction via 2^level
    woodBase: 1_000_000, stoneBase: 500_000, factor: 2.0,
    requires: { building: 'workshop', level: 10 },
  },
  {
    id: 'barracks',        // shipyard — needed for Phase 6 units
    woodBase: 400, stoneBase: 200, factor: 2.0,
  },
  {
    id: 'academy',         // research_lab — needed for Phase 5 research
    woodBase: 200, stoneBase: 400, factor: 2.0,
  },
]

// ── Cost formula: base * factor^level ────────────────────────────────────────

export function buildCost(woodBase, stoneBase, factor, level) {
  const f = Math.pow(factor, level)
  return {
    wood:  Math.floor(woodBase  * f),
    stone: Math.floor(stoneBase * f),
  }
}

// ── Build time (seconds) — matches PlanetService.getBuildingConstructionTime ──
// formula: (wood + stone) / (2500 * max(4 - nextLevel/2, 1) * (1 + workshop) * speed * 2^engineersGuild) * 3600
// minimum: 1 second

export function buildTime(wood, stone, nextLevel, workshopLevel, engineersGuildLevel, speed = 1) {
  const isEngineersGuild = false // handled identically in this variant (no special case needed)
  const levelFactor = Math.max(4 - nextLevel / 2, 1)
  const divisor = 2500 * levelFactor * (1 + workshopLevel) * speed * Math.pow(2, engineersGuildLevel)
  const timeSeconds = Math.max(1, Math.round(((wood + stone) / divisor) * 3600))
  return timeSeconds
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

export function populationMax(windmillLevel) {
  return windmillLevel === 0 ? 0 : Math.floor(20 * windmillLevel * Math.pow(1.1, windmillLevel))
}

// ── After completing a queue item: apply side-effects to kingdom patch ────────

export function applyBuildingEffect(building, newLevel) {
  const patch = { [building]: newLevel }
  if (building === 'sawmill')   patch.woodProduction  = woodProduction(newLevel)
  if (building === 'quarry')    patch.stoneProduction = stoneProduction(newLevel)
  if (building === 'grainFarm') patch.grainProduction = grainProduction(newLevel)
  if (building === 'windmill')  patch.populationMax   = populationMax(newLevel)
  return patch
}
