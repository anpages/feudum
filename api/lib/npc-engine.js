/**
 * npc-engine.js — shared NPC constants and pure helper functions.
 * No DB access, no side-effects. Imported by combat-engine, npc-builder, npc-military-ai.
 */
import {
  windmillEnergy, cathedralEnergy, sawmillEnergy, quarryEnergy, grainFarmEnergy,
} from './buildings.js'

// ── Identity ──────────────────────────────────────────────────────────────────

export function npcPersonality(kingdom) {
  const h = ((kingdom.realm * 374761 + kingdom.region * 6271 + kingdom.slot * 1013) >>> 0) % 3
  return ['economy', 'military', 'balanced'][h]
}

export function npcClass(kingdom) {
  const h = ((kingdom.realm * 571349 + kingdom.region * 31337 + kingdom.slot * 9901) >>> 0) % 3
  return ['collector', 'general', 'discoverer'][h]
}

// Fallback research row with all levels at 0 — used when no DB row exists yet
export const EMPTY_RESEARCH = {
  swordsmanship: 0, armoury: 0, fortification: 0,
  horsemanship: 0, cartography: 0, tradeRoutes: 0,
  alchemy: 0, pyromancy: 0, runemastery: 0, mysticism: 0, dragonlore: 0,
  spycraft: 0, logistics: 0, exploration: 0, diplomaticNetwork: 0, divineBlessing: 0,
}

// ── Unit / defense key lists ──────────────────────────────────────────────────

export const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

export const NPC_UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

export const NPC_DEFENSE_KEYS = [
  'archer','crossbowman','ballista','trebuchet',
  'mageTower','dragonCannon','palisade','castleWall','moat','catapult','beacon',
]

export const UNIT_COMBAT_SET  = new Set(['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight'])
export const UNIT_SUPPORT_SET = new Set(['merchant','caravan','scavenger'])
export const UNIT_DEFENSE_SET = new Set(['archer','crossbowman','ballista','mageTower','trebuchet','dragonCannon','castleWall','moat','catapult'])

// ── Unit costs ────────────────────────────────────────────────────────────────

export const UNIT_COSTS = {
  squire:      { wood: 3000,    stone: 1000,   grain: 0    },
  archer:      { wood: 2000,    stone: 0,      grain: 0    },
  crossbowman: { wood: 1500,    stone: 500,    grain: 0    },
  knight:      { wood: 6000,    stone: 4000,   grain: 0    },
  ballista:    { wood: 6000,    stone: 2000,   grain: 0    },
  mageTower:   { wood: 2000,    stone: 6000,   grain: 0    },
  paladin:     { wood: 20000,   stone: 7000,   grain: 0    },
  warlord:     { wood: 45000,   stone: 15000,  grain: 0    },
  grandKnight: { wood: 30000,   stone: 40000,  grain: 0    },
  siegeMaster: { wood: 50000,   stone: 25000,  grain: 0    },
  warMachine:  { wood: 60000,   stone: 50000,  grain: 0    },
  dragonKnight:{ wood: 5000000, stone: 4000000,grain: 0    },
  merchant:    { wood: 2000,    stone: 2000,   grain: 0    },
  caravan:     { wood: 6000,    stone: 6000,   grain: 0    },
  scavenger:   { wood: 10000,   stone: 6000,   grain: 2000 },
}

// ── Build / unit priorities per personality ───────────────────────────────────

export const BUILD_WEIGHTS = {
  economy: {
    sawmill: 1.0, windmill: 1.5, quarry: 0.85, grainFarm: 0.70,
    cathedral: 0.50, granary: 0.55, stonehouse: 0.50, silo: 0.45,
    workshop: 0.65, barracks: 0.60, academy: 0.25,
    alchemistTower: 0.40, ambassadorHall: 0.20, armoury: 0.35, engineersGuild: 0.35,
  },
  military: {
    barracks: 1.0, sawmill: 0.75, windmill: 1.5, quarry: 0.65, workshop: 0.60,
    grainFarm: 0.55, armoury: 0.50, granary: 0.35,
    stonehouse: 0.35, silo: 0.30, academy: 0.25,
    alchemistTower: 0.25, ambassadorHall: 0.30, cathedral: 0.20, engineersGuild: 0.25,
  },
  balanced: {
    sawmill: 0.90, windmill: 1.5, barracks: 0.80, quarry: 0.75, grainFarm: 0.65,
    workshop: 0.60, granary: 0.45, stonehouse: 0.40,
    silo: 0.35, academy: 0.30, alchemistTower: 0.35,
    armoury: 0.35, ambassadorHall: 0.25, cathedral: 0.30, engineersGuild: 0.30,
  },
}

export const UNIT_PRIORITY = {
  economy:  ['squire', 'merchant', 'archer', 'caravan', 'crossbowman', 'knight', 'scavenger', 'mageTower', 'ballista', 'paladin', 'warlord', 'grandKnight', 'siegeMaster', 'warMachine', 'dragonKnight'],
  military: ['squire', 'knight', 'archer', 'crossbowman', 'paladin', 'warlord', 'ballista', 'mageTower', 'grandKnight', 'siegeMaster', 'warMachine', 'dragonKnight', 'merchant', 'scavenger'],
  balanced: ['squire', 'merchant', 'archer', 'knight', 'crossbowman', 'scavenger', 'paladin', 'mageTower', 'ballista', 'caravan', 'warlord', 'grandKnight', 'siegeMaster', 'warMachine', 'dragonKnight'],
}

export const ATTACK_THRESHOLD = {
  economy:  8,
  military: 5,
  balanced: 6,
}

// ── Milestone tables (hours → target building levels) ────────────────────────

export const MILESTONES = {
  economy: [
    { hours: 0,   sawmill: 2,  quarry: 1,  grainFarm: 0, windmill: 2,  workshop: 0, barracks: 0 },
    { hours: 24,  sawmill: 6,  quarry: 4,  grainFarm: 2, windmill: 6,  workshop: 1, barracks: 0 },
    { hours: 72,  sawmill: 9,  quarry: 6,  grainFarm: 4, windmill: 10, workshop: 1, barracks: 0 },
    { hours: 120, sawmill: 10, quarry: 7,  grainFarm: 5, windmill: 11, workshop: 1, barracks: 1 },
    { hours: 168, sawmill: 12, quarry: 8,  grainFarm: 6, windmill: 13, workshop: 2, barracks: 2 },
    { hours: 336, sawmill: 15, quarry: 11, grainFarm: 8, windmill: 16, workshop: 2, barracks: 3 },
    { hours: 672, sawmill: 18, quarry: 14, grainFarm:10, windmill: 19, workshop: 3, barracks: 4 },
  ],
  military: [
    { hours: 0,   sawmill: 2,  quarry: 1,  grainFarm: 0, windmill: 2,  workshop: 0, barracks: 0 },
    { hours: 24,  sawmill: 4,  quarry: 3,  grainFarm: 1, windmill: 4,  workshop: 1, barracks: 0 },
    { hours: 72,  sawmill: 6,  quarry: 4,  grainFarm: 2, windmill: 7,  workshop: 1, barracks: 2 },
    { hours: 168, sawmill: 8,  quarry: 5,  grainFarm: 3, windmill: 10, workshop: 2, barracks: 3 },
    { hours: 336, sawmill: 11, quarry: 7,  grainFarm: 5, windmill: 13, workshop: 2, barracks: 4 },
    { hours: 672, sawmill: 14, quarry: 10, grainFarm: 7, windmill: 16, workshop: 3, barracks: 5 },
  ],
  balanced: [
    { hours: 0,   sawmill: 2,  quarry: 1,  grainFarm: 0, windmill: 2,  workshop: 0, barracks: 0 },
    { hours: 24,  sawmill: 5,  quarry: 3,  grainFarm: 1, windmill: 5,  workshop: 1, barracks: 0 },
    { hours: 72,  sawmill: 7,  quarry: 5,  grainFarm: 3, windmill: 8,  workshop: 1, barracks: 1 },
    { hours: 168, sawmill: 10, quarry: 7,  grainFarm: 5, windmill: 11, workshop: 2, barracks: 3 },
    { hours: 336, sawmill: 13, quarry: 9,  grainFarm: 7, windmill: 14, workshop: 2, barracks: 4 },
    { hours: 672, sawmill: 16, quarry: 12, grainFarm: 9, windmill: 17, workshop: 3, barracks: 5 },
  ],
}

export const MILESTONE_ORDER = ['windmill', 'sawmill', 'quarry', 'grainFarm', 'workshop', 'barracks']

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function totalArmy(k) {
  return UNIT_KEYS.reduce((s, u) => s + (k[u] ?? 0), 0)
}

export function isSleepTime(now) {
  const hour = new Date(now * 1000).getUTCHours()
  return hour >= 1 && hour < 8
}

export function getNpcDelay(now) {
  if (isSleepTime(now)) return 3600 + Math.floor(Math.random() * 3600)
  return 480 + Math.floor(Math.random() * 240)
}

export function getTargetLevels(personality, ageHours) {
  const rows = MILESTONES[personality] ?? MILESTONES.balanced
  let target = rows[0]
  for (const row of rows) {
    if (ageHours >= row.hours) target = row
  }
  return target
}

export function getTickFlavor(personality, kingdom, ageHours) {
  const tickIdx  = Math.floor(ageHours)
  const posShift = ((kingdom.realm * 17 + kingdom.region * 7 + kingdom.slot * 3) >>> 0) % 10
  const adjusted = (tickIdx + posShift) % 10
  const troopTicks = { military: 6, economy: 1, balanced: 5 }
  return adjusted < (troopTicks[personality] ?? 5) ? 'troops' : 'buildings'
}

export function calcEnergyBalance(kingdom) {
  const prod = windmillEnergy(kingdom.windmill  ?? 0)
             + cathedralEnergy(kingdom.cathedral ?? 0, 0)
  const cons = sawmillEnergy(kingdom.sawmill   ?? 0)
             + quarryEnergy(kingdom.quarry     ?? 0)
             + grainFarmEnergy(kingdom.grainFarm ?? 0)
  return prod - cons
}

export function depletionFactor(count) {
  return Math.max(0.3, 1 - Math.max(0, count - 3) * 0.10)
}

export function extractK(row, keys) {
  const out = {}
  for (const k of keys) out[k] = row[k] ?? 0
  return out
}
