/**
 * NPC hourly cron — resource tick + growth AI + attack AI + return processing.
 * Called by Vercel Cron: schedule "0 * * * *"
 * Secured with CRON_SECRET header.
 */
import { eq, and, lte } from 'drizzle-orm'
import { db, users, kingdoms, armyMissions, messages, debrisFields } from '../_db.js'
import { applyResourceTick } from '../lib/tick.js'
import { BUILDINGS, buildCost, buildTime, applyBuildingEffect } from '../lib/buildings.js'
import { ECONOMY_SPEED, NPC_AGGRESSION, NPC_ATTACK_INTERVAL_HOURS } from '../lib/config.js'
import { calcDistance, calcDuration } from '../lib/speed.js'
import {
  buildBattleUnits, runBattle, calculateLoot,
  calculateDebris, repairDefenses, calcCargoCapacity,
} from '../lib/battle.js'
import { getSettings } from '../lib/settings.js'

// ── Identity system ───────────────────────────────────────────────────────────
// Both personality and class are deterministic from position — never change.
// Personality: build order + attack behavior
// Class: numerical stat bonuses (mirrors player character class system)

function npcPersonality(kingdom) {
  const h = ((kingdom.realm * 374761 + kingdom.region * 6271 + kingdom.slot * 1013) >>> 0) % 3
  return ['economy', 'military', 'balanced'][h]
}

function npcClass(kingdom) {
  // Different hash seed so class is independent from personality (9 combinations)
  const h = ((kingdom.realm * 571349 + kingdom.region * 31337 + kingdom.slot * 9901) >>> 0) % 3
  return ['collector', 'general', 'discoverer'][h]
}

// Class stat modifiers applied in growth + combat:
// collector:  +25% resource production (accumulates faster, harder to loot dry)
// general:    −10% unit cost, +1 extra unit type trained per tick, attacks more aggressively
// discoverer: +1 extra building per tick (researches / builds faster), wider attack search radius

// ── Build priorities per personality ─────────────────────────────────────────
// economy:  focus production first, barracks last
// military: barracks early, then enough production to sustain army
// balanced: steady mix

const BUILD_PRIORITY = {
  economy:  ['windmill', 'sawmill', 'quarry', 'grainFarm', 'sawmill', 'quarry', 'workshop', 'barracks', 'engineersGuild'],
  military: ['windmill', 'sawmill', 'barracks', 'quarry', 'sawmill', 'workshop', 'grainFarm', 'barracks', 'quarry'],
  balanced: ['windmill', 'sawmill', 'grainFarm', 'quarry', 'barracks', 'workshop', 'sawmill', 'quarry', 'engineersGuild'],
}

// ── Building targets per personality × level ──────────────────────────────────
// [personality][level]
const BUILDING_TARGETS = {
  economy: [
    null,
    { sawmill: 4,  quarry: 3,  grainFarm: 3, windmill: 2, barracks: 1, workshop: 0 },
    { sawmill: 8,  quarry: 6,  grainFarm: 5, windmill: 3, barracks: 2, workshop: 2 },
    { sawmill: 14, quarry: 11, grainFarm: 8, windmill: 5, barracks: 4, workshop: 4, engineersGuild: 2 },
  ],
  military: [
    null,
    { sawmill: 2,  quarry: 2,  grainFarm: 2, windmill: 1, barracks: 2, workshop: 1 },
    { sawmill: 5,  quarry: 4,  grainFarm: 3, windmill: 2, barracks: 5, workshop: 3 },
    { sawmill: 9,  quarry: 8,  grainFarm: 5, windmill: 4, barracks: 8, workshop: 5, engineersGuild: 3 },
  ],
  balanced: [
    null,
    { sawmill: 3,  quarry: 3,  grainFarm: 2, windmill: 1, barracks: 1, workshop: 0 },
    { sawmill: 6,  quarry: 5,  grainFarm: 4, windmill: 2, barracks: 3, workshop: 2 },
    { sawmill: 11, quarry: 9,  grainFarm: 6, windmill: 4, barracks: 6, workshop: 4, engineersGuild: 2 },
  ],
}

// ── Unit targets per personality × level ──────────────────────────────────────
const UNIT_TARGETS = {
  economy: [
    null,
    { squire: 5,  archer: 15 },
    { squire: 10, archer: 25, crossbowman: 10 },
    { squire: 15, archer: 35, crossbowman: 20, knight: 10, mageTower: 10 },
  ],
  military: [
    null,
    { squire: 15, archer: 10, crossbowman: 5 },
    { squire: 25, knight: 20, archer: 15, crossbowman: 15, ballista: 5 },
    { knight: 35, paladin: 30, warlord: 15, crossbowman: 25, mageTower: 15, ballista: 10 },
  ],
  balanced: [
    null,
    { squire: 10, archer: 20 },
    { squire: 20, knight: 15, archer: 20, crossbowman: 10 },
    { knight: 25, paladin: 25, warlord: 12, crossbowman: 25, mageTower: 12, archer: 20 },
  ],
}

// ── Attack threshold per personality (min army before attacking) ───────────────
const ATTACK_THRESHOLD = {
  economy:  [0, 30, 55, 75],   // attacks late, only when well-defended
  military: [0, 15, 30, 45],   // attacks early, aggressive raider
  balanced: [0, 22, 40, 60],
}

// ── Minimum barracks level per unit ──────────────────────────────────────────
const UNIT_BARRACKS_REQ = {
  squire: 1, archer: 1, crossbowman: 2, knight: 3,
  ballista: 4, mageTower: 4, paladin: 5, warlord: 7,
}

// ── Unit costs ────────────────────────────────────────────────────────────────
const UNIT_COSTS = {
  squire:      { wood: 3000,  stone: 1000  },
  archer:      { wood: 2000,  stone: 0     },
  crossbowman: { wood: 1500,  stone: 500   },
  knight:      { wood: 6000,  stone: 4000  },
  ballista:    { wood: 6000,  stone: 2000  },
  mageTower:   { wood: 2000,  stone: 6000  },
  paladin:     { wood: 20000, stone: 7000  },
  warlord:     { wood: 45000, stone: 15000 },
}

const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

function totalArmy(k) {
  return UNIT_KEYS.reduce((s, u) => s + (k[u] ?? 0), 0)
}

// ── Growth AI ─────────────────────────────────────────────────────────────────

async function growNpc(kingdom, cfg) {
  const npcLevel    = kingdom.npcLevel || 1
  const personality = npcPersonality(kingdom)
  const cls         = npcClass(kingdom)
  const targets     = BUILDING_TARGETS[personality][npcLevel]
  const priority    = BUILD_PRIORITY[personality]

  // Builds per tick: base = npcLevel; discoverer gets +1 extra
  const maxBuilds = npcLevel + (cls === 'discoverer' ? 1 : 0)

  let { wood, stone, grain } = kingdom
  let patch = {}
  let buildsThisTick = 0

  for (const b of priority) {
    if (buildsThisTick >= maxBuilds) break

    const currentLv = (patch[b] !== undefined ? patch[b] : kingdom[b]) ?? 0
    const targetLv  = targets?.[b] ?? 0
    if (currentLv >= targetLv) continue

    const def = BUILDINGS.find(x => x.id === b)
    if (!def) continue

    const nextLv = currentLv + 1
    const cost = buildCost(def.woodBase, def.stoneBase, def.factor, nextLv - 1, def.grainBase ?? 0)

    if (wood >= cost.wood && stone >= cost.stone && grain >= (cost.grain ?? 0)) {
      wood  -= cost.wood
      stone -= cost.stone
      grain -= (cost.grain ?? 0)
      const effect = applyBuildingEffect(b, nextLv, { ...kingdom, ...patch })
      Object.assign(patch, effect)
      buildsThisTick++
    }
  }

  // Unit training: general trains 2 extra types, L3 gets 2, others 1
  const unitTargets  = UNIT_TARGETS[personality][npcLevel] ?? {}
  const barracksLv   = (patch.barracks ?? kingdom.barracks) ?? 0
  const maxUnitTypes = (npcLevel >= 3 ? 2 : 1) + (cls === 'general' ? 1 : 0)
  // general reduces effective unit cost by 10%
  const costMult = cls === 'general' ? 0.9 : 1.0
  let unitTypesThisTick = 0

  for (const [unitId, targetCount] of Object.entries(unitTargets)) {
    if (unitTypesThisTick >= maxUnitTypes) break

    const current = kingdom[unitId] ?? 0
    if (current >= targetCount) continue
    const reqBarracks = UNIT_BARRACKS_REQ[unitId] ?? 1
    if (barracksLv < reqBarracks) continue

    const cost = UNIT_COSTS[unitId]
    if (!cost) continue
    const need    = targetCount - current
    const effWood  = Math.ceil(cost.wood  * costMult)
    const effStone = Math.ceil(cost.stone * costMult)
    const canAff  = Math.min(
      need,
      Math.floor(wood / effWood),
      effStone > 0 ? Math.floor(stone / effStone) : need,
    )
    if (canAff <= 0) continue

    wood  -= effWood  * canAff
    stone -= effStone * canAff
    patch[unitId] = current + canAff
    unitTypesThisTick++
  }

  if (Object.keys(patch).length === 0) return

  await db.update(kingdoms).set({
    ...patch,
    wood, stone, grain,
    lastResourceUpdate: Math.floor(Date.now() / 1000),
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, kingdom.id))
}

// ── Attack AI ─────────────────────────────────────────────────────────────────

async function attackAI(npcKingdom, playerKingdoms, now, cfg) {
  if (NPC_AGGRESSION === 0) return false

  const npcLevel    = npcKingdom.npcLevel || 1
  const personality = npcPersonality(npcKingdom)
  const cls         = npcClass(npcKingdom)
  const armySize    = totalArmy(npcKingdom)

  // general gets -5 threshold (attacks earlier), collector gets +5 (attacks later)
  const baseThreshold = ATTACK_THRESHOLD[personality][npcLevel]
  const threshold = baseThreshold + (cls === 'general' ? -5 : cls === 'collector' ? 5 : 0)

  if (armySize < threshold) return false

  // Skip if NPC already has an active attack mission
  // general can have 2 simultaneous missions (more aggressive)
  const activeMissions = await db.select({ id: armyMissions.id })
    .from(armyMissions)
    .where(and(
      eq(armyMissions.userId,      npcKingdom.userId),
      eq(armyMissions.missionType, 'attack'),
      eq(armyMissions.state,       'active'),
    ))
  const maxMissions = cls === 'general' ? 2 : 1
  if (activeMissions.length >= maxMissions) return false

  // Search radius: discoverer can range further (+1 region)
  const baseRadius = 1
  const radius = baseRadius + (cls === 'discoverer' ? 1 : 0)

  const sameRegion = playerKingdoms.filter(
    p => p.realm === npcKingdom.realm && p.region === npcKingdom.region
  )
  const candidates = sameRegion.length > 0
    ? sameRegion
    : playerKingdoms.filter(
        p => p.realm === npcKingdom.realm && Math.abs(p.region - npcKingdom.region) <= radius
      )

  if (candidates.length === 0) return false

  // Target selection per personality + class:
  // military → weakest (easy win); economy+collector → richest (max loot); others → richest
  let target
  if (personality === 'military') {
    target = candidates.reduce((best, p) =>
      (p.wood + p.stone + p.grain) < (best.wood + best.stone + best.grain) ? p : best
    )
  } else {
    target = candidates.reduce((best, p) =>
      (p.wood + p.stone + p.grain) > (best.wood + best.stone + best.grain) ? p : best
    )
  }

  // Compose force:
  // general sends more (70-90%), economy sends less (50-70%), discoverer is moderate (55-75%)
  const minRatio = cls === 'general' ? 0.70 : cls === 'economy' || personality === 'economy' ? 0.50 : 0.55
  const maxRatio = cls === 'general' ? 0.90 : cls === 'economy' || personality === 'economy' ? 0.70 : 0.75
  const sendRatio = minRatio + Math.random() * (maxRatio - minRatio)

  const force = {}
  let totalSent = 0
  for (const u of UNIT_KEYS) {
    const n = npcKingdom[u] ?? 0
    if (n === 0) continue
    const send = Math.floor(n * sendRatio)
    if (send > 0) { force[u] = send; totalSent += send }
  }
  if (totalSent === 0) return false

  const universeSpeed = parseFloat(cfg.fleet_speed_war ?? 1)
  const dist       = calcDistance(npcKingdom, target)
  const travelSecs = calcDuration(dist, force, 100, universeSpeed)
  const arrivalTime = now + travelSecs

  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'attack',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  target.realm,
    targetRegion: target.region,
    targetSlot:   target.slot,
    departureTime: now,
    arrivalTime,
    ...force,
  })

  // Deduct sent units from NPC kingdom
  const deduct = {}
  for (const [u, n] of Object.entries(force)) deduct[u] = (npcKingdom[u] ?? 0) - n
  await db.update(kingdoms).set({ ...deduct, updatedAt: new Date() })
    .where(eq(kingdoms.id, npcKingdom.id))

  return true
}

// ── Process NPC return missions ───────────────────────────────────────────────

async function processNpcReturns(npcUserId, npcKingdomsById, now) {
  const returning = await db.select().from(armyMissions)
    .where(and(
      eq(armyMissions.userId, npcUserId),
      eq(armyMissions.state,  'returning'),
      lte(armyMissions.returnTime, now),
    ))

  for (const m of returning) {
    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (!npcKingdom) {
      await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      continue
    }

    const patch = { updatedAt: new Date() }
    for (const u of UNIT_KEYS) {
      const n = m[u] ?? 0
      if (n > 0) patch[u] = (npcKingdom[u] ?? 0) + n
    }
    if ((m.woodLoad  ?? 0) > 0) patch.wood  = Math.min((npcKingdom.wood  ?? 0) + m.woodLoad,  npcKingdom.woodCapacity)
    if ((m.stoneLoad ?? 0) > 0) patch.stone = Math.min((npcKingdom.stone ?? 0) + m.stoneLoad, npcKingdom.stoneCapacity)
    if ((m.grainLoad ?? 0) > 0) patch.grain = Math.min((npcKingdom.grain ?? 0) + m.grainLoad, npcKingdom.grainCapacity)

    await db.update(kingdoms).set(patch).where(eq(kingdoms.id, npcKingdom.id))
    await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
    Object.assign(npcKingdom, patch)
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const now = Math.floor(Date.now() / 1000)
  const cfg = await getSettings()

  // Load NPC system user
  const [npcUser] = await db.select({ id: users.id })
    .from(users).where(eq(users.isNpc, true)).limit(1)
  if (!npcUser) return res.json({ ok: true, skipped: 'no_npc_user' })

  const npcUserId = npcUser.id

  // Load all NPC kingdoms
  const npcKingdoms = await db.select().from(kingdoms)
    .where(eq(kingdoms.isNpc, true))

  if (npcKingdoms.length === 0) return res.json({ ok: true, skipped: 'no_npc_kingdoms' })

  // Build lookup map by position
  const npcKingdomsById = {}
  for (const k of npcKingdoms) npcKingdomsById[`${k.realm}:${k.region}:${k.slot}`] = k

  // Load all player kingdoms for attack target selection
  const playerKingdoms = await db.select({
    id: kingdoms.id, userId: kingdoms.userId,
    realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
    wood: kingdoms.wood, stone: kingdoms.stone, grain: kingdoms.grain,
  }).from(kingdoms).where(eq(kingdoms.isNpc, false))

  // ── Process NPC return missions first ──────────────────────────────────────
  await processNpcReturns(npcUserId, npcKingdomsById, now)

  // ── Per-NPC tick, growth, and attack ──────────────────────────────────────
  let ticked = 0, grew = 0, attacked = 0

  for (const kingdom of npcKingdoms) {
    // Resource tick — collector class gets +25% on top of what was produced this tick
    const tickResult = applyResourceTick(kingdom, cfg)
    const cls = npcClass(kingdom)
    const extraWood  = cls === 'collector' ? Math.floor((tickResult.wood  - kingdom.wood)  * 0.25) : 0
    const extraStone = cls === 'collector' ? Math.floor((tickResult.stone - kingdom.stone) * 0.25) : 0
    const extraGrain = cls === 'collector' ? Math.floor((tickResult.grain - kingdom.grain) * 0.25) : 0
    const finalWood  = Math.min(tickResult.wood  + extraWood,  kingdom.woodCapacity)
    const finalStone = Math.min(tickResult.stone + extraStone, kingdom.stoneCapacity)
    const finalGrain = Math.min(tickResult.grain + extraGrain, kingdom.grainCapacity)

    if (
      finalWood  !== kingdom.wood ||
      finalStone !== kingdom.stone ||
      finalGrain !== kingdom.grain
    ) {
      await db.update(kingdoms).set({
        wood:               finalWood,
        stone:              finalStone,
        grain:              finalGrain,
        lastResourceUpdate: now,
        updatedAt:          new Date(),
      }).where(eq(kingdoms.id, kingdom.id))
      kingdom.wood               = finalWood
      kingdom.stone              = finalStone
      kingdom.grain              = finalGrain
      kingdom.lastResourceUpdate = now
      ticked++
    }

    // Growth AI
    await growNpc(kingdom, cfg)
    grew++

    // Attack AI
    if (NPC_AGGRESSION > 0 && playerKingdoms.length > 0) {
      const launched = await attackAI(kingdom, playerKingdoms, now, cfg)
      if (launched) attacked++
    }
  }

  // ── Debug breakdown ────────────────────────────────────────────────────────
  const byPersonality = { economy: 0, military: 0, balanced: 0 }
  const byClass = { collector: 0, general: 0, discoverer: 0 }
  for (const k of npcKingdoms) {
    byPersonality[npcPersonality(k)]++
    byClass[npcClass(k)]++
  }

  return res.json({ ok: true, npcCount: npcKingdoms.length, ticked, grew, attacked, byPersonality, byClass })
}
