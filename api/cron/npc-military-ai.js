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
import { NPC_AGGRESSION, NPC_ATTACK_INTERVAL_HOURS, NPC_BASH_LIMIT, UNIVERSE } from '../lib/config.js'
import { calcDistance, calcDuration } from '../lib/speed.js'
import { sendPush } from '../lib/push.js'
import { getSettings, setSetting } from '../lib/settings.js'
import {
  UNIT_KEYS, UNIT_COMBAT_SET, UNIT_SUPPORT_SET, UNIT_DEFENSE_SET, UNIT_PRIORITY,
  UNIT_COSTS, ATTACK_THRESHOLD,
  npcPersonality, npcClass, totalArmy, depletionFactor, EMPTY_RESEARCH,
} from '../lib/npc-engine.js'

const FLEET_RESERVE   = 0.20   // fraction of combat fleet kept home before any mission
const SCAVENGER_CARGO = 20000  // cargo per scavenger unit
const MIN_DEBRIS      = 500    // minimum total debris (wood+stone) worth dispatching scavengers

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

async function attackAI(npcKingdom, researchRow, allKingdoms, bashMap, spyMap, now, cfg) {
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

  const minRatio  = cls === 'general' ? 0.70 : personality === 'economy' ? 0.50 : 0.55
  const maxRatio  = cls === 'general' ? 0.90 : personality === 'economy' ? 0.70 : 0.75
  // Cap at (1 - FLEET_RESERVE) so the NPC always keeps ≥20% of its combat fleet home
  const sendRatio = Math.min(minRatio + Math.random() * (maxRatio - minRatio), 1 - FLEET_RESERVE)

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

  // Espionaje previo al ataque — NPCs con exploradores evalúan riesgo antes de atacar
  if ((npcKingdom.scout ?? 0) > 0 && !npcKingdom.isBoss) {
    const spyState = spyMap[npcKingdom.userId]
    const targetKey = `${target.realm}:${target.region}:${target.slot}`

    if (spyState?.inFlight) {
      return false // espía en ruta — esperar resultado
    }

    if (spyState?.result && spyState.targetKey === targetKey) {
      // Tenemos inteligencia reciente sobre este objetivo — evaluar riesgo
      const atkTotal   = Object.values(force).reduce((s, n) => s + n, 0)
      const defUnits   = Object.values(spyState.result.units   ?? {}).reduce((s, n) => s + n, 0)
      const defDefense = Object.values(spyState.result.defense ?? {}).reduce((s, n) => s + n, 0)
      const totalDef   = defUnits + defDefense
      const riskRatio  = { economy: 1.5, balanced: 0.8, military: 0.5 }[personality] ?? 0.8
      if (totalDef > 0 && atkTotal < totalDef * riskRatio) {
        return false // demasiado arriesgado — abortar
      }
      // Riesgo aceptable → proceder con el ataque (fall through)
    } else {
      // Sin inteligencia para este objetivo → enviar explorador primero
      const scouts = Math.min(2, npcKingdom.scout ?? 0)
      const spyDist     = calcDistance(npcKingdom, target)
      const spyTravelSecs = calcDuration(spyDist, { scout: scouts }, 100, universeSpeed, researchRow, null)
      await db.insert(armyMissions).values({
        userId:       npcKingdom.userId,
        missionType:  'spy',
        state:        'active',
        startRealm:   npcKingdom.realm,
        startRegion:  npcKingdom.region,
        startSlot:    npcKingdom.slot,
        targetRealm:  target.realm,
        targetRegion: target.region,
        targetSlot:   target.slot,
        departureTime: now,
        arrivalTime:  now + spyTravelSecs,
        units: { scout: scouts },
      })
      await upsertUnit(npcKingdom.id, 'scout', (npcKingdom.scout ?? 0) - scouts)
      npcKingdom.scout = (npcKingdom.scout ?? 0) - scouts
      spyMap[npcKingdom.userId] = { inFlight: true, result: null, targetKey }
      return false // ataque aplazado hasta que vuelva el espía
    }
  }

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

async function scavengeAI(npcKingdom, allDebris, now, cfg, probability = 0.40) {
  const scavengerCount = npcKingdom.scavenger ?? 0
  if (scavengerCount === 0) return false
  if (Math.random() > probability) return false

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

  const debrisTotal = (target.wood ?? 0) + (target.stone ?? 0)
  if (debrisTotal < MIN_DEBRIS) return false

  // Don't over-commit scavengers: cap at enough to carry 10× the available debris
  const maxUseful   = Math.ceil((debrisTotal * 10) / SCAVENGER_CARGO)
  const sendCount   = Math.min(scavengerCount, Math.max(1, maxUseful))

  const force = { scavenger: sendCount }
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
    units: { scavenger: sendCount },
  })

  await upsertUnit(npcKingdom.id, 'scavenger', scavengerCount - sendCount)
  npcKingdom.scavenger = scavengerCount - sendCount

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
  for (let r = 1; r <= UNIVERSE.maxRegion; r++) {
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

  // Fleet reserve: ensure at least FLEET_RESERVE of combat units remains home
  const combatHome = [...UNIT_COMBAT_SET].reduce((s, u) => s + (npcKingdom[u] ?? 0), 0)
  const combatSent = Object.entries(force).filter(([u]) => UNIT_COMBAT_SET.has(u)).reduce((s, [, n]) => s + n, 0)
  if (combatHome > 0 && (combatHome - combatSent) < combatHome * FLEET_RESERVE) return false

  const holdingTime   = 1800 + Math.floor(Math.random() * 1800)
  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const origin = { realm: npcKingdom.realm, region: npcKingdom.region, slot: npcKingdom.slot }
  const target = { realm: REALM, region: bestRegion, slot: UNIVERSE.maxSlot + 1 }
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
    targetSlot:   UNIVERSE.maxSlot + 1,
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

// ── Colonize AI ───────────────────────────────────────────────────────────────

async function colonizeAI(npcKingdom, allKingdoms, colonizeActiveSet, colonizePendingSlots, researchRow, now, cfg) {
  if ((npcKingdom.colonist ?? 0) === 0) return false
  if (colonizeActiveSet.has(npcKingdom.userId)) return false

  // Limit: max 2 kingdoms per NPC user
  const ownedCount = allKingdoms.filter(k => k.userId === npcKingdom.userId).length
  if (ownedCount >= 2) return false

  // Find nearest empty slot — same region first, then adjacent
  const { realm, region } = npcKingdom
  const takenSlots = new Set(allKingdoms.map(k => `${k.realm}:${k.region}:${k.slot}`))

  let targetCoord = null
  outer: for (let offset = 0; offset <= 3 && !targetCoord; offset++) {
    for (const r of [...new Set([region, region + offset, region - offset])]) {
      if (r < 1 || r > UNIVERSE.maxRegion) continue
      for (let slot = 1; slot <= UNIVERSE.maxSlot; slot++) {
        const key = `${realm}:${r}:${slot}`
        if (!takenSlots.has(key) && !colonizePendingSlots.has(key)) {
          targetCoord = { realm, region: r, slot }
          break outer
        }
      }
    }
  }
  if (!targetCoord) return false

  const force = { colonist: 1 }
  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const dist       = calcDistance(npcKingdom, targetCoord)
  const travelSecs = calcDuration(dist, force, 100, universeSpeed, researchRow, null)

  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'colonize',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  targetCoord.realm,
    targetRegion: targetCoord.region,
    targetSlot:   targetCoord.slot,
    departureTime: now,
    arrivalTime:  now + travelSecs,
    units: force,
  })

  await upsertUnit(npcKingdom.id, 'colonist', 0)
  npcKingdom.colonist = 0

  colonizeActiveSet.add(npcKingdom.userId)
  colonizePendingSlots.add(`${targetCoord.realm}:${targetCoord.region}:${targetCoord.slot}`)

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

  // Spy missions from last 2h — used to decide if NPC should send scout before attacking
  const recentSpyMissions = npcUserIds.length
    ? await db.select({
        userId:       armyMissions.userId,
        targetRealm:  armyMissions.targetRealm,
        targetRegion: armyMissions.targetRegion,
        targetSlot:   armyMissions.targetSlot,
        state:        armyMissions.state,
        result:       armyMissions.result,
      }).from(armyMissions)
        .where(and(
          inArray(armyMissions.userId, npcUserIds),
          eq(armyMissions.missionType, 'spy'),
          gte(armyMissions.departureTime, now - 7200),
        ))
    : []

  // spyMap: userId → { inFlight, result, targetKey }
  const spyMap = {}
  for (const s of recentSpyMissions) {
    if (!spyMap[s.userId]) spyMap[s.userId] = { inFlight: false, result: null, targetKey: null }
    if (s.state === 'active') {
      spyMap[s.userId].inFlight = true
    } else if (s.state === 'returning' && s.result && !spyMap[s.userId].result) {
      try {
        spyMap[s.userId].result    = JSON.parse(s.result)
        spyMap[s.userId].targetKey = `${s.targetRealm}:${s.targetRegion}:${s.targetSlot}`
      } catch {}
    }
  }

  // Active colonize missions — to avoid duplicate colonist training/dispatch
  const activeColonizeMissions = npcUserIds.length
    ? await db.select({
        userId:       armyMissions.userId,
        targetRealm:  armyMissions.targetRealm,
        targetRegion: armyMissions.targetRegion,
        targetSlot:   armyMissions.targetSlot,
      }).from(armyMissions)
        .where(and(
          inArray(armyMissions.userId, npcUserIds),
          eq(armyMissions.missionType, 'colonize'),
          eq(armyMissions.state, 'active'),
        ))
    : []
  const colonizeActiveSet    = new Set(activeColonizeMissions.map(m => m.userId))
  const colonizePendingSlots = new Set(activeColonizeMissions.map(m => `${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`))

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
  let colonized = 0

  for (const kingdom of allNpcKingdoms) {
    try {
      const researchRow = researchByUser[kingdom.userId] ?? EMPTY_RESEARCH
      const personality = npcPersonality(kingdom)
      const cls         = npcClass(kingdom)

      // 1. Carroñeo prioritario — collector/economy actúan antes de atacar
      if ((cls === 'collector' || personality === 'economy') && allDebris.length > 0) {
        const prob = cls === 'collector' ? 0.80 : 0.60
        const claimedId = await scavengeAI(kingdom, allDebris, now, cfg, prob)
        if (claimedId) {
          scavenged++
          const idx = allDebris.findIndex(d => d.id === claimedId)
          if (idx >= 0) allDebris.splice(idx, 1)
        }
      }

      // 2. Ataque (con espionaje previo si tiene exploradores)
      if (NPC_AGGRESSION > 0 && allKingdoms.length > 1) {
        const launched = await attackAI(kingdom, researchRow, allKingdoms, bashMap, spyMap, now, cfg)
        if (launched) attacked++
      }

      // 3. Carroñeo secundario — military/balanced después de atacar
      if (cls !== 'collector' && personality !== 'economy' && allDebris.length > 0) {
        const prob = personality === 'military' ? 0.20 : 0.40
        const claimedId = await scavengeAI(kingdom, allDebris, now, cfg, prob)
        if (claimedId) {
          scavenged++
          const idx = allDebris.findIndex(d => d.id === claimedId)
          if (idx >= 0) allDebris.splice(idx, 1)
        }
      }

      // 4. Colonización — si tiene colonizador y slot disponible
      const didColonize = await colonizeAI(kingdom, allKingdoms, colonizeActiveSet, colonizePendingSlots, researchRow, now, cfg)
      if (didColonize) colonized++

      // 5. Expedición
      const didExpedition = await expeditionAI(kingdom, researchRow, depletionMap, now, cfg)
      if (didExpedition) expeditioned++

    } catch (err) {
      console.error(`[npc-military-ai] kingdom ${kingdom.id} error:`, err?.message ?? err)
    }
  }

  // Persist tick for admin monitor
  const militaryTick = { at: now, npcCount: allNpcKingdoms.length, attacked, scavenged, expeditioned, colonized }
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
    attacked, scavenged, expeditioned, colonized,
  })
}
