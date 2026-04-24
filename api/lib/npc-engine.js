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
export const UNIT_SUPPORT_SET = new Set(['merchant','caravan','scavenger','scout'])
export const UNIT_DEFENSE_SET = new Set(['archer','crossbowman','palisade','ballista','mageTower','trebuchet','dragonCannon','castleWall','moat','catapult'])

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
  scout:    { wood: 0,     stone: 1000,  grain: 0     },
  colonist: { wood: 10000, stone: 20000, grain: 10000 },
  // Defenses — required for UNIT_PRIORITY resolution
  palisade:    { wood: 10000, stone: 10000, grain: 0     },
  moat:        { wood: 5000,  stone: 2000,  grain: 0     },
  catapult:    { wood: 12000, stone: 3000,  grain: 1000  },
  trebuchet:   { wood: 20000, stone: 15000, grain: 2000  },
  castleWall:  { wood: 50000, stone: 50000, grain: 0     },
  dragonCannon:{ wood: 50000, stone: 50000, grain: 30000 },
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

// Unit training priority per personality.
// Ordering reflects natural progression: build economy/army base first,
// then unlock support/intel capability, then defense line, then elite forces.
// Prerequisites gate each unit automatically — placing a unit early just means
// "train it as soon as requirements are met," not "train it at second 0."
// Defense and support units are skipped until armySize >= ATTACK_THRESHOLD (needMoreCombat check).
export const UNIT_PRIORITY = {
  // Economy (collector): trade and intel before combat escalation;
  // defense as shield for accumulated resources; heavy combat late.
  economy: [
    'squire',        // combat minimum — unlocks support/defense training
    'merchant',      // cargo early: trade routes + loot transport
    'scout',         // intel before any attack decision
    'archer',        // cheap static defense
    'caravan',       // large cargo (horsemanship 6 gate)
    'crossbowman',   // better ranged defense
    'knight',        // first real combat unit
    'moat',          // passive fortification (armoury building 1)
    'scavenger',     // debris collection (horsemanship 6 + runemastery 2)
    'paladin',       // mid-tier combat
    'mageTower',     // high-shield defense
    'palisade',      // large shield dome (armoury research 2)
    'ballista',      // heavy laser defense
    'catapult',      // siege defense (armoury building 2)
    'trebuchet',     // gauss-equivalent defense
    'castleWall',    // max shield fortification
    'warlord',       // late heavy combat
    'grandKnight',   // elite (very late requirements)
    'siegeMaster',
    'warMachine',
    'dragonCannon',  // plasma-equivalent defense (dragonlore 7)
    'dragonKnight',  // endgame
  ],

  // Military (general): combat mass first, intel second, strong defense line, support minimal.
  military: [
    'squire',        // fast/cheap combat
    'knight',        // core heavy combat
    'archer',        // basic defense while growing
    'scout',         // intel before attacks (barracks 3 + spycraft 2)
    'crossbowman',   // better ranged defense
    'paladin',       // elite combat unit
    'moat',          // passive fortification
    'warlord',       // heavy combat
    'ballista',      // defense upgrade
    'mageTower',     // high-shield defense
    'palisade',      // large shield dome
    'catapult',      // siege defense
    'grandKnight',   // top-tier combat
    'trebuchet',     // advanced defense
    'siegeMaster',   // bomber equivalent
    'castleWall',    // max fortification
    'warMachine',    // destroyer equivalent
    'merchant',      // minimal cargo for looting
    'caravan',       // large cargo late-game
    'scavenger',     // opportunistic debris
    'dragonCannon',  // advanced defense
    'dragonKnight',  // endgame
  ],

  // Balanced (discoverer): everything in natural proportions; scouts early for intel;
  // reasonable mix of combat, support, and defense throughout.
  balanced: [
    'squire',        // basic combat
    'merchant',      // trade capability (barracks 1 + horsemanship 2)
    'scout',         // intel early (barracks 3 + spycraft 2)
    'archer',        // basic defense
    'knight',        // heavy combat
    'crossbowman',   // defense upgrade
    'moat',          // passive fortification
    'scavenger',     // debris collection
    'paladin',       // elite combat
    'mageTower',     // shield defense
    'palisade',      // dome fortification
    'ballista',      // heavy defense
    'caravan',       // large cargo (horsemanship 6)
    'catapult',      // siege defense
    'trebuchet',     // advanced defense
    'warlord',       // heavy combat
    'castleWall',    // max fortification
    'grandKnight',   // elite forces
    'siegeMaster',
    'warMachine',
    'dragonCannon',
    'dragonKnight',
  ],
}

export const ATTACK_THRESHOLD = {
  economy:  8,
  military: 5,
  balanced: 6,
}

// ── Milestone tables (hours → target building levels) ────────────────────────

export const MILESTONES = {
  // academy included so the research tree unlocks naturally:
  //   lv1 → alchemy, lv2 → cartography, lv3 → spycraft, lv6 → armoury research, lv7 → tradeRoutes
  economy: [
    { hours: 0,    sawmill: 2,  quarry: 1,  grainFarm: 0,  windmill: 2,  workshop: 0, barracks: 0, academy: 0 },
    { hours: 24,   sawmill: 6,  quarry: 4,  grainFarm: 2,  windmill: 6,  workshop: 1, barracks: 0, academy: 1 },
    { hours: 72,   sawmill: 9,  quarry: 6,  grainFarm: 4,  windmill: 10, workshop: 1, barracks: 0, academy: 2 },
    { hours: 120,  sawmill: 10, quarry: 7,  grainFarm: 5,  windmill: 11, workshop: 1, barracks: 1, academy: 3 },
    { hours: 168,  sawmill: 12, quarry: 8,  grainFarm: 6,  windmill: 13, workshop: 2, barracks: 2, academy: 4 },
    { hours: 336,  sawmill: 15, quarry: 11, grainFarm: 8,  windmill: 16, workshop: 2, barracks: 3, academy: 5 },
    { hours: 672,  sawmill: 18, quarry: 14, grainFarm: 10, windmill: 19, workshop: 3, barracks: 4, academy: 5 },
    { hours: 720,  sawmill: 19, quarry: 15, grainFarm: 11, windmill: 20, workshop: 3, barracks: 5, academy: 6, engineersGuild: 1, armoury: 0 },
    { hours: 1080, sawmill: 21, quarry: 17, grainFarm: 12, windmill: 22, workshop: 3, barracks: 6, academy: 7, engineersGuild: 2, armoury: 1 },
    { hours: 1440, sawmill: 24, quarry: 19, grainFarm: 14, windmill: 25, workshop: 4, barracks: 7, academy: 8, engineersGuild: 3, armoury: 2 },
  ],
  military: [
    { hours: 0,    sawmill: 2,  quarry: 1,  grainFarm: 0,  windmill: 2,  workshop: 0, barracks: 0,  academy: 0 },
    { hours: 24,   sawmill: 4,  quarry: 3,  grainFarm: 1,  windmill: 4,  workshop: 1, barracks: 0,  academy: 1 },
    { hours: 72,   sawmill: 6,  quarry: 4,  grainFarm: 2,  windmill: 7,  workshop: 1, barracks: 2,  academy: 1 },
    { hours: 168,  sawmill: 8,  quarry: 5,  grainFarm: 3,  windmill: 10, workshop: 2, barracks: 3,  academy: 2 },
    { hours: 336,  sawmill: 11, quarry: 7,  grainFarm: 5,  windmill: 13, workshop: 2, barracks: 4,  academy: 3 },
    { hours: 672,  sawmill: 14, quarry: 10, grainFarm: 7,  windmill: 16, workshop: 3, barracks: 5,  academy: 3 },
    { hours: 720,  sawmill: 15, quarry: 11, grainFarm: 8,  windmill: 17, workshop: 3, barracks: 7,  academy: 4, engineersGuild: 1, armoury: 3 },
    { hours: 1080, sawmill: 17, quarry: 13, grainFarm: 9,  windmill: 19, workshop: 3, barracks: 9,  academy: 5, engineersGuild: 2, armoury: 5 },
    { hours: 1440, sawmill: 20, quarry: 16, grainFarm: 11, windmill: 22, workshop: 4, barracks: 11, academy: 6, engineersGuild: 3, armoury: 7 },
  ],
  balanced: [
    { hours: 0,    sawmill: 2,  quarry: 1,  grainFarm: 0,  windmill: 2,  workshop: 0, barracks: 0,  academy: 0 },
    { hours: 24,   sawmill: 5,  quarry: 3,  grainFarm: 1,  windmill: 5,  workshop: 1, barracks: 0,  academy: 1 },
    { hours: 72,   sawmill: 7,  quarry: 5,  grainFarm: 3,  windmill: 8,  workshop: 1, barracks: 1,  academy: 2 },
    { hours: 168,  sawmill: 10, quarry: 7,  grainFarm: 5,  windmill: 11, workshop: 2, barracks: 3,  academy: 3 },
    { hours: 336,  sawmill: 13, quarry: 9,  grainFarm: 7,  windmill: 14, workshop: 2, barracks: 4,  academy: 4 },
    { hours: 672,  sawmill: 16, quarry: 12, grainFarm: 9,  windmill: 17, workshop: 3, barracks: 5,  academy: 4 },
    { hours: 720,  sawmill: 17, quarry: 13, grainFarm: 10, windmill: 18, workshop: 3, barracks: 7,  academy: 5, engineersGuild: 1, armoury: 2 },
    { hours: 1080, sawmill: 19, quarry: 15, grainFarm: 11, windmill: 20, workshop: 3, barracks: 9,  academy: 6, engineersGuild: 2, armoury: 4 },
    { hours: 1440, sawmill: 22, quarry: 18, grainFarm: 13, windmill: 23, workshop: 4, barracks: 10, academy: 7, engineersGuild: 3, armoury: 6 },
  ],
}

export const MILESTONE_ORDER = ['windmill', 'sawmill', 'quarry', 'grainFarm', 'workshop', 'barracks', 'academy', 'engineersGuild', 'armoury']

// ── Research priorities per personality ──────────────────────────────────────
// Ordered list of research IDs to pursue proactively during 'research' flavor ticks.
// Prerequisites are chained automatically by attemptResearch — placing a tech early
// means "advance it as soon as the prerequisite tree allows," not "research at minute 0."

export const RESEARCH_PRIORITY = {
  // Economy (collector): production boosters + trade chain + exploration; combat last.
  economy:  ['alchemy', 'horsemanship', 'cartography', 'runemastery', 'spycraft', 'pyromancy', 'fortification', 'swordsmanship', 'exploration', 'mysticism', 'armoury', 'tradeRoutes', 'logistics', 'dragonlore', 'divineBlessing', 'diplomaticNetwork'],
  // Military (general): combat bonuses first, then colonization/intel, then support.
  military: ['alchemy', 'horsemanship', 'fortification', 'swordsmanship', 'cartography', 'spycraft', 'pyromancy', 'runemastery', 'armoury', 'logistics', 'exploration', 'mysticism', 'tradeRoutes', 'dragonlore', 'divineBlessing', 'diplomaticNetwork'],
  // Balanced (discoverer): spread evenly; intel and colonization early.
  balanced: ['alchemy', 'horsemanship', 'cartography', 'spycraft', 'fortification', 'swordsmanship', 'pyromancy', 'runemastery', 'exploration', 'logistics', 'armoury', 'mysticism', 'tradeRoutes', 'dragonlore', 'divineBlessing', 'diplomaticNetwork'],
}

// Maximum levels the proactive system pushes toward per tech per personality.
// Higher targets for specialties; lower where the personality doesn't benefit as much.
export const RESEARCH_TARGETS = {
  economy: {
    alchemy: 6, horsemanship: 6, cartography: 4, runemastery: 2, spycraft: 3,
    pyromancy: 3, fortification: 3, swordsmanship: 3, exploration: 5, mysticism: 3,
    armoury: 4, tradeRoutes: 3, logistics: 3, dragonlore: 2, divineBlessing: 2, diplomaticNetwork: 2,
  },
  military: {
    alchemy: 4, horsemanship: 6, fortification: 6, swordsmanship: 6, cartography: 3,
    spycraft: 3, pyromancy: 5, runemastery: 2, armoury: 7, logistics: 5,
    exploration: 3, mysticism: 3, tradeRoutes: 2, dragonlore: 3, divineBlessing: 2, diplomaticNetwork: 1,
  },
  balanced: {
    alchemy: 5, horsemanship: 6, cartography: 4, spycraft: 3, fortification: 4,
    swordsmanship: 4, pyromancy: 4, runemastery: 2, exploration: 4, logistics: 4,
    armoury: 5, mysticism: 3, tradeRoutes: 3, dragonlore: 2, divineBlessing: 2, diplomaticNetwork: 2,
  },
}

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

export function getTickFlavor(personality, kingdom, _ageHours) {
  // Rota cada minuto: buildings → troops → research (ciclo de 3).
  // posShift desincroniza NPCs para que no actúen todos igual en el mismo minuto.
  const minute   = new Date().getMinutes()
  const posShift = ((kingdom.realm * 17 + kingdom.region * 7 + kingdom.slot * 3) >>> 0) % 3
  const phase    = (minute + posShift) % 3
  // El ciclo varía por personalidad para preservar el carácter de cada NPC.
  const cycles = {
    military: ['troops',    'buildings', 'troops'   ],  // 2/3 enfocado en ejército
    economy:  ['buildings', 'buildings', 'research' ],  // 2/3 en producción
    balanced: ['buildings', 'troops',   'research'  ],  // uno de cada
  }
  return (cycles[personality] ?? cycles.balanced)[phase]
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
