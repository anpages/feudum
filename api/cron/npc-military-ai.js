/**
 * npc-military-ai — NPC attack, scavenge and expedition dispatch.
 * Vercel Cron: every 20 minutes ("*/20 * * * *").
 * Runs on ALL NPCs (no npcNextCheck filter); per-unit cooldowns prevent spam.
 */
import { eq, and, gte, inArray, ne, or } from 'drizzle-orm'
import {
  db, users, kingdoms, npcState, buildings, units, research,
  armyMissions, debrisFields,
} from '../_db.js'
import { upsertUnit } from '../lib/db-helpers.js'
import { NPC_AGGRESSION, NPC_ATTACK_INTERVAL_HOURS, NPC_BASH_LIMIT } from '../lib/config.js'
import { calcDistance, calcDuration } from '../lib/speed.js'
import { sendPush } from '../lib/push.js'
import { getSettings, setSetting } from '../lib/settings.js'
import {
  UNIT_KEYS, UNIT_COMBAT_SET, UNIT_SUPPORT_SET, UNIT_DEFENSE_SET, UNIT_PRIORITY,
  UNIT_COSTS, ATTACK_THRESHOLD,
  npcPersonality, npcClass, totalArmy, depletionFactor, EMPTY_RESEARCH,
} from '../lib/npc-engine.js'

// ── Expedition depletion ──────────────────────────────────────────────────────

async function getExpeditionDepletion(now) {
  const since = now - 86400
  const rows = await db.select({
    targetRealm:  armyMissions.targetRealm,
    targetRegion: armyMissions.targetRegion,
  }).from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'expedition'),
      gte(armyMissions.departureTime, since),
    ))
  const map = {}
  for (const r of rows) {
    const key = `${r.targetRealm}:${r.targetRegion}`
    map[key] = (map[key] ?? 0) + 1
  }
  return map
}

// ── Attack AI ─────────────────────────────────────────────────────────────────

async function attackAI(npcKingdom, researchRow, allKingdoms, bashMap, now, cfg) {
  if (npcKingdom.isBoss) return false
  if (NPC_AGGRESSION === 0) return false

  const personality = npcPersonality(npcKingdom)
  const cls         = npcClass(npcKingdom)
  const armySize    = [...UNIT_COMBAT_SET].reduce((s, u) => s + (npcKingdom[u] ?? 0), 0)

  const baseThreshold = ATTACK_THRESHOLD[personality]
  const threshold = baseThreshold + (cls === 'general' ? -2 : cls === 'collector' ? 3 : 0)
  if (armySize < threshold) return false

  const intervalSecs = NPC_ATTACK_INTERVAL_HOURS * 3600
  const lastAttack = npcKingdom.lastAttackAt ?? 0
  if (now - lastAttack < intervalSecs) return false

  const activeMissions = await db.select({ id: armyMissions.id })
    .from(armyMissions)
    .where(and(
      eq(armyMissions.missionType,  'attack'),
      eq(armyMissions.state,        'active'),
      eq(armyMissions.startRealm,   npcKingdom.realm),
      eq(armyMissions.startRegion,  npcKingdom.region),
      eq(armyMissions.startSlot,    npcKingdom.slot),
    ))
  const maxMissions = cls === 'general' ? 2 : 1
  if (activeMissions.length >= maxMissions) return false

  const radius = 1 + (cls === 'discoverer' ? 1 : 0)
  const atkCoord = `${npcKingdom.realm}:${npcKingdom.region}:${npcKingdom.slot}`
  const sameRegion = allKingdoms.filter(
    p => p.id !== npcKingdom.id &&
         !p.isBoss &&
         p.realm === npcKingdom.realm &&
         p.region === npcKingdom.region
  )
  const candidates = sameRegion.length > 0
    ? sameRegion
    : allKingdoms.filter(
        p => p.id !== npcKingdom.id &&
             !p.isBoss &&
             p.realm === npcKingdom.realm &&
             Math.abs(p.region - npcKingdom.region) <= radius
      )

  if (candidates.length === 0) return false

  const npcTotal = (npcKingdom.wood ?? 0) + (npcKingdom.stone ?? 0) + (npcKingdom.grain ?? 0)
  const minResources = Math.max(2000, npcTotal * 0.3)
  const eligible = candidates.filter(p => ((p.wood ?? 0) + (p.stone ?? 0) + (p.grain ?? 0)) >= minResources)
  if (eligible.length === 0) return false

  const withinLimit = eligible.filter(p => {
    const key = `${atkCoord}→${p.realm}:${p.region}:${p.slot}`
    return (bashMap[key] ?? 0) < NPC_BASH_LIMIT
  })
  if (withinLimit.length === 0) return false

  const totalWeight = withinLimit.reduce((s, p) => s + Math.max(1, (p.wood ?? 0) + (p.stone ?? 0) + (p.grain ?? 0)), 0)
  let rand = Math.random() * totalWeight
  let target = withinLimit[withinLimit.length - 1]
  for (const p of withinLimit) {
    rand -= Math.max(1, (p.wood ?? 0) + (p.stone ?? 0) + (p.grain ?? 0))
    if (rand <= 0) { target = p; break }
  }

  const minRatio = cls === 'general' ? 0.70 : personality === 'economy' ? 0.50 : 0.55
  const maxRatio = cls === 'general' ? 0.90 : personality === 'economy' ? 0.70 : 0.75
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
  const dist          = calcDistance(npcKingdom, target)
  const npcCharClass  = cls === 'general' ? 'general' : null
  const travelSecs    = calcDuration(dist, force, 100, universeSpeed, researchRow, npcCharClass)
  const arrivalTime   = now + travelSecs

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
    units: force,
  })

  // Update npcState.lastAttackAt
  await db.update(npcState).set({ lastAttackAt: now, updatedAt: new Date() })
    .where(eq(npcState.userId, npcKingdom.userId))

  // Deduct units from units table
  for (const [u, n] of Object.entries(force)) {
    await upsertUnit(npcKingdom.id, u, (npcKingdom[u] ?? 0) - n)
  }

  if (!target.isNpc && target.userId) {
    const eta = Math.round(travelSecs / 60)
    sendPush(target.userId, {
      title: '⚔️ ¡Ataque entrante!',
      body: `${npcKingdom.name} (NPC) te ataca. Llega en ~${eta} min.`,
      url: '/armies',
      tag: 'incoming-attack',
    }).catch(() => {})
  }

  return true
}

// ── Scavenge AI ───────────────────────────────────────────────────────────────

async function scavengeAI(npcKingdom, allDebris, now, cfg) {
  const scavengerCount = npcKingdom.scavenger ?? 0
  if (scavengerCount === 0) return false
  if (Math.random() > 0.40) return false

  const existing = await db.select({ id: armyMissions.id }).from(armyMissions).where(and(
    eq(armyMissions.missionType, 'scavenge'),
    eq(armyMissions.state,       'active'),
    eq(armyMissions.startRealm,  npcKingdom.realm),
    eq(armyMissions.startRegion, npcKingdom.region),
    eq(armyMissions.startSlot,   npcKingdom.slot),
  )).limit(1)
  if (existing.length > 0) return false

  const nearby = allDebris.filter(d =>
    d.realm  === npcKingdom.realm &&
    d.region === npcKingdom.region &&
    (d.wood + d.stone) > 0
  )
  if (nearby.length === 0) return false

  const target = nearby.reduce((best, d) =>
    (d.wood + d.stone) > (best.wood + best.stone) ? d : best
  )

  const force = { scavenger: scavengerCount }
  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const origin = { realm: npcKingdom.realm, region: npcKingdom.region, slot: npcKingdom.slot }
  const dest   = { realm: target.realm,     region: target.region,     slot: target.slot   }
  const dist       = calcDistance(origin, dest)
  const travelSecs = calcDuration(dist, force, 100, universeSpeed, {})
  const arrivalTime = now + travelSecs

  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'scavenge',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  target.realm,
    targetRegion: target.region,
    targetSlot:   target.slot,
    departureTime: now,
    arrivalTime,
    units: { scavenger: scavengerCount },
  })

  await upsertUnit(npcKingdom.id, 'scavenger', 0)
  npcKingdom.scavenger = 0

  return target.id
}

// ── Expedition AI ─────────────────────────────────────────────────────────────

async function expeditionAI(npcKingdom, researchRow, depletionMap, now, cfg) {
  if (npcKingdom.isBoss) return false
  const cls         = npcClass(npcKingdom)
  const personality = npcPersonality(npcKingdom)
  const probability = cls === 'discoverer' ? 0.35 : personality === 'balanced' ? 0.12 : 0
  if (probability === 0 || Math.random() > probability) return false

  const total = totalArmy(npcKingdom)
  if (total < 20) return false

  const existing = await db.select({ id: armyMissions.id }).from(armyMissions).where(and(
    eq(armyMissions.missionType, 'expedition'),
    eq(armyMissions.startRealm,  npcKingdom.realm),
    eq(armyMissions.startRegion, npcKingdom.region),
    eq(armyMissions.startSlot,   npcKingdom.slot),
    or(eq(armyMissions.state, 'active'), eq(armyMissions.state, 'exploring')),
  )).limit(1)
  if (existing.length > 0) return false

  const REALM = npcKingdom.realm
  let bestRegion = npcKingdom.region
  let bestFactor = -1
  for (let r = 1; r <= 10; r++) {
    const count  = depletionMap[`${REALM}:${r}`] ?? 0
    const factor = depletionFactor(count)
    if (
      factor > bestFactor ||
      (factor === bestFactor && Math.abs(r - npcKingdom.region) < Math.abs(bestRegion - npcKingdom.region))
    ) {
      bestFactor = factor
      bestRegion = r
    }
  }

  const sendRatio = 0.15 + Math.random() * 0.10
  const force = {}
  let totalSent = 0
  for (const u of UNIT_KEYS) {
    const n = npcKingdom[u] ?? 0
    if (n === 0) continue
    const send = Math.floor(n * sendRatio)
    if (send > 0) { force[u] = send; totalSent += send }
  }
  if (totalSent < 2) return false

  const holdingTime   = 1800 + Math.floor(Math.random() * 1800)
  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const origin = { realm: npcKingdom.realm, region: npcKingdom.region, slot: npcKingdom.slot }
  const target = { realm: REALM, region: bestRegion, slot: 16 }
  const dist        = calcDistance(origin, target)
  const travelSecs  = calcDuration(dist, force, 100, universeSpeed, researchRow, null)
  const arrivalTime = now + travelSecs

  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'expedition',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  REALM,
    targetRegion: bestRegion,
    targetSlot:   16,
    departureTime: now,
    arrivalTime,
    holdingTime,
    units: force,
  })

  // Deduct units from units table
  for (const [u, n] of Object.entries(force)) {
    await upsertUnit(npcKingdom.id, u, (npcKingdom[u] ?? 0) - n)
    npcKingdom[u] = (npcKingdom[u] ?? 0) - n
  }

  const key = `${REALM}:${bestRegion}`
  depletionMap[key] = (depletionMap[key] ?? 0) + 1

  return true
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const now = Math.floor(Date.now() / 1000)
  const cfg = await getSettings()

  if (cfg.season_state !== 'active') {
    return res.json({ ok: true, skipped: 'no_active_season' })
  }

  // ── Batch load all NPC kingdoms with their npcState ──────────────────────
  const npcRows = await db.select({ k: kingdoms, ns: npcState })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .leftJoin(npcState, eq(npcState.userId, users.id))
    .where(eq(users.role, 'npc'))

  if (npcRows.length === 0) return res.json({ ok: true, skipped: 'no_npc_kingdoms' })

  const npcKingdomIds = npcRows.map(r => r.k.id)
  const npcUserIds    = npcRows.map(r => r.k.userId)

  const [allBuildings, allUnitsRows, allResearchRows] = await Promise.all([
    db.select().from(buildings).where(inArray(buildings.kingdomId, npcKingdomIds)),
    db.select().from(units).where(inArray(units.kingdomId, npcKingdomIds)),
    db.select().from(research).where(inArray(research.userId, npcUserIds)),
  ])

  // Build lookup maps
  const buildingsByKingdom = {}
  for (const b of allBuildings) {
    if (!buildingsByKingdom[b.kingdomId]) buildingsByKingdom[b.kingdomId] = {}
    buildingsByKingdom[b.kingdomId][b.type] = b.level
  }
  const unitsByKingdom = {}
  for (const u of allUnitsRows) {
    if (!unitsByKingdom[u.kingdomId]) unitsByKingdom[u.kingdomId] = {}
    unitsByKingdom[u.kingdomId][u.type] = u.quantity
  }
  const researchByUser = {}
  for (const r of allResearchRows) {
    if (!researchByUser[r.userId]) researchByUser[r.userId] = {}
    researchByUser[r.userId][r.type] = r.level
  }

  // Enrich NPC kingdoms (merge buildings + units + npcState fields)
  const allNpcKingdoms = npcRows.map(({ k, ns }) => ({
    ...k,
    ...(buildingsByKingdom[k.id] ?? {}),
    ...(unitsByKingdom[k.id] ?? {}),
    isBoss:              ns?.isBoss              ?? false,
    npcLevel:            ns?.npcLevel            ?? 1,
    buildAvailableAt:    ns?.buildAvailableAt     ?? null,
    nextCheck:           ns?.nextCheck            ?? null,
    currentResearch:     ns?.currentResearch      ?? null,
    researchAvailableAt: ns?.researchAvailableAt  ?? null,
    lastAttackAt:        ns?.lastAttackAt         ?? 0,
    lastDecision:        ns?.lastDecision         ?? null,
  }))

  // ── Load player kingdoms ─────────────────────────────────────────────────
  const playerRows = await db.select({ k: kingdoms, userRole: users.role })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .where(ne(users.role, 'npc'))

  const playerKingdoms = playerRows.map(({ k, userRole }) => ({
    ...k,
    isNpc: userRole === 'npc',
    isBoss: false,
  }))

  const allKingdoms = [
    ...playerKingdoms,
    ...allNpcKingdoms.map(k => ({
      id: k.id, userId: k.userId, name: k.name,
      isNpc: true, isBoss: k.isBoss,
      realm: k.realm, region: k.region, slot: k.slot,
      wood: k.wood, stone: k.stone, grain: k.grain,
    })),
  ]

  // ── Bash limit map (attacks last 24h) ────────────────────────────────────
  const recentAttacks = await db.select({
    startRealm:   armyMissions.startRealm,
    startRegion:  armyMissions.startRegion,
    startSlot:    armyMissions.startSlot,
    targetRealm:  armyMissions.targetRealm,
    targetRegion: armyMissions.targetRegion,
    targetSlot:   armyMissions.targetSlot,
  }).from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'attack'),
      gte(armyMissions.createdAt,  new Date(Date.now() - 24 * 3600 * 1000)),
    ))
  const bashMap = {}
  for (const r of recentAttacks) {
    const key = `${r.startRealm}:${r.startRegion}:${r.startSlot}→${r.targetRealm}:${r.targetRegion}:${r.targetSlot}`
    bashMap[key] = (bashMap[key] ?? 0) + 1
  }

  // ── Debris fields ────────────────────────────────────────────────────────
  const allDebris = await db.select({
    id: debrisFields.id, realm: debrisFields.realm, region: debrisFields.region, slot: debrisFields.slot,
    wood: debrisFields.wood, stone: debrisFields.stone,
  }).from(debrisFields)

  const depletionMap = await getExpeditionDepletion(now)

  // ── Per-NPC AI loop ──────────────────────────────────────────────────────
  let attacked = 0, scavenged = 0, expeditioned = 0

  for (const kingdom of allNpcKingdoms) {
    try {
      const researchRow = researchByUser[kingdom.userId] ?? EMPTY_RESEARCH

      if (NPC_AGGRESSION > 0 && allKingdoms.length > 1) {
        const launched = await attackAI(kingdom, researchRow, allKingdoms, bashMap, now, cfg)
        if (launched) attacked++
      }

      const claimedDebrisId = await scavengeAI(kingdom, allDebris, now, cfg)
      if (claimedDebrisId) {
        scavenged++
        const idx = allDebris.findIndex(d => d.id === claimedDebrisId)
        if (idx >= 0) allDebris.splice(idx, 1)
      }

      const didExpedition = await expeditionAI(kingdom, researchRow, depletionMap, now, cfg)
      if (didExpedition) expeditioned++
    } catch (err) {
      console.error(`[npc-military-ai] kingdom ${kingdom.id} error:`, err?.message ?? err)
    }
  }

  // Persist tick for admin monitor
  const militaryTick = { at: now, npcCount: allNpcKingdoms.length, attacked, scavenged, expeditioned }
  const MAX_HISTORY = 48
  let militaryHistory = []
  try { const raw = cfg.military_ai_tick_history; if (raw) militaryHistory = JSON.parse(raw) } catch { militaryHistory = [] }
  militaryHistory.push(militaryTick)
  if (militaryHistory.length > MAX_HISTORY) militaryHistory = militaryHistory.slice(-MAX_HISTORY)
  await Promise.all([
    setSetting('military_ai_last_tick',    JSON.stringify(militaryTick)),
    setSetting('military_ai_tick_history', JSON.stringify(militaryHistory)),
  ])

  return res.json({
    ok: true, at: now,
    npcCount: allNpcKingdoms.length,
    attacked, scavenged, expeditioned,
  })
}
