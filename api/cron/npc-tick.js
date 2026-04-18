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

// ── NPC configuration ─────────────────────────────────────────────────────────

// Building targets per npcLevel [unused, level1, level2, level3]
const BUILDING_TARGETS = [
  null,
  { sawmill: 3,  quarry: 3,  grainFarm: 2, windmill: 1, barracks: 1 },
  { sawmill: 6,  quarry: 5,  grainFarm: 4, windmill: 2, barracks: 3, workshop: 2 },
  { sawmill: 10, quarry: 9,  grainFarm: 6, windmill: 4, barracks: 5, workshop: 4 },
]

// Unit targets per npcLevel: { unitId: targetCount }
const UNIT_TARGETS = [
  null,
  { squire: 10, archer: 20 },
  { squire: 20, knight: 15, archer: 20, crossbowman: 10 },
  { knight: 20, paladin: 20, warlord: 10, mageTower: 10, crossbowman: 20 },
]

// Minimum barracks required to train each unit (skip research check for NPCs)
const UNIT_BARRACKS_REQ = {
  squire: 1, archer: 1, crossbowman: 2, knight: 3,
  ballista: 4, mageTower: 4, paladin: 5, warlord: 7,
}

// Unit base costs (wood, stone) from units.js
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

const ATTACK_THRESHOLD = [0, 25, 45, 60]  // min army size before attacking
const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]
const DEFENSE_KEYS = [
  'archer','crossbowman','ballista','trebuchet',
  'mageTower','dragonCannon','palisade','castleWall','moat','catapult','beacon',
]

function totalArmy(k) {
  return UNIT_KEYS.reduce((s, u) => s + (k[u] ?? 0), 0)
}

// ── Growth AI ─────────────────────────────────────────────────────────────────

async function growNpc(kingdom, cfg) {
  const npcLevel = kingdom.npcLevel || 1
  const targets  = BUILDING_TARGETS[npcLevel]
  const speed    = parseFloat(cfg.economy_speed ?? ECONOMY_SPEED)
  const buildingPriority = ['sawmill','quarry','grainFarm','windmill','barracks','workshop']

  let { wood, stone, grain } = kingdom
  let patch = {}

  // Try to build the next building
  for (const b of buildingPriority) {
    const currentLv = kingdom[b] ?? 0
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
      break  // only one building per tick
    }
  }

  // Try to train units (only if barracks built)
  const unitTargets = UNIT_TARGETS[npcLevel] ?? {}
  const barracksLv  = (patch.barracks ?? kingdom.barracks) ?? 0

  for (const [unitId, targetCount] of Object.entries(unitTargets)) {
    const current = kingdom[unitId] ?? 0
    if (current >= targetCount) continue
    const reqBarracks = UNIT_BARRACKS_REQ[unitId] ?? 1
    if (barracksLv < reqBarracks) continue

    const cost    = UNIT_COSTS[unitId]
    if (!cost) continue
    const need    = targetCount - current
    const canAff  = Math.min(need, Math.floor(wood / cost.wood), cost.stone > 0 ? Math.floor(stone / cost.stone) : need)
    if (canAff <= 0) continue

    wood  -= cost.wood  * canAff
    stone -= (cost.stone ?? 0) * canAff
    patch[unitId] = current + canAff
    break  // one unit type per tick
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
  if (NPC_AGGRESSION === 0) return

  const npcLevel   = npcKingdom.npcLevel || 1
  const armySize   = totalArmy(npcKingdom)
  if (armySize < ATTACK_THRESHOLD[npcLevel]) return

  // Skip if NPC already has an active attack mission
  const [existingMission] = await db.select({ id: armyMissions.id })
    .from(armyMissions)
    .where(and(
      eq(armyMissions.userId,      npcKingdom.userId),
      eq(armyMissions.missionType, 'attack'),
      eq(armyMissions.state,       'active'),
    )).limit(1)
  if (existingMission) return

  // Find richest player kingdom in same realm+region (any slot)
  const sameRegion = playerKingdoms.filter(
    p => p.realm === npcKingdom.realm && p.region === npcKingdom.region
  )
  // Expand to ±1 region if no targets
  const candidates = sameRegion.length > 0
    ? sameRegion
    : playerKingdoms.filter(
        p => p.realm === npcKingdom.realm && Math.abs(p.region - npcKingdom.region) <= 1
      )

  if (candidates.length === 0) return

  // Pick the richest target
  const target = candidates.reduce((best, p) =>
    (p.wood + p.stone + p.grain) > (best.wood + best.stone + best.grain) ? p : best
  )

  // Compose attack force: 70% of army
  const sendRatio = 0.60 + Math.random() * 0.20
  const force = {}
  let totalSent = 0
  for (const u of UNIT_KEYS) {
    const n = npcKingdom[u] ?? 0
    if (n === 0) continue
    const send = Math.floor(n * sendRatio)
    if (send > 0) { force[u] = send; totalSent += send }
  }
  if (totalSent === 0) return

  const speed = parseFloat(cfg.fleet_speed_war ?? 1) * ECONOMY_SPEED
  const dist  = calcDistance(npcKingdom, target)
  const travelSecs = calcDuration(dist, force, 100, speed)
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
    // Update in-memory copy so subsequent returns in same cron tick use fresh values
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
    // Resource tick
    const tickResult = applyResourceTick(kingdom, cfg)
    if (tickResult.now !== Math.floor(Date.now() / 1000) || tickResult.wood !== kingdom.wood) {
      await db.update(kingdoms).set({
        wood:               tickResult.wood,
        stone:              tickResult.stone,
        grain:              tickResult.grain,
        lastResourceUpdate: now,
        updatedAt:          new Date(),
      }).where(eq(kingdoms.id, kingdom.id))
      kingdom.wood  = tickResult.wood
      kingdom.stone = tickResult.stone
      kingdom.grain = tickResult.grain
      kingdom.lastResourceUpdate = now
      ticked++
    }

    // Growth AI
    const prevBuilding = kingdom.sawmill + kingdom.quarry + kingdom.barracks
    await growNpc(kingdom, cfg)
    grew++

    // Attack AI
    if (NPC_AGGRESSION > 0 && playerKingdoms.length > 0) {
      await attackAI(kingdom, playerKingdoms, now, cfg)
      attacked++
    }
  }

  return res.json({ ok: true, npcCount: npcKingdoms.length, ticked, grew, attacked })
}
