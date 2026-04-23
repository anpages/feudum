/**
 * npc-builder — resource tick + cascade growth AI for NPC kingdoms.
 * Vercel Cron: every minute ("* * * * *").
 * Only processes NPCs whose nextCheck has expired (staggered 8–12 min windows).
 *
 * Schema: normalized — buildings/units/research are separate tables.
 * NPC AI state lives in npc_state (PK: userId), not in kingdoms.
 */
import { eq, and, gte, or, inArray } from 'drizzle-orm'
import { db, users, kingdoms, npcState, buildings, units, research, armyMissions } from '../_db.js'
import { upsertBuilding, upsertUnit, upsertResearch } from '../lib/db-helpers.js'
import { applyResourceTick } from '../lib/tick.js'
import {
  BUILDINGS, buildCost, buildTime, applyBuildingEffect,
} from '../lib/buildings.js'
import { ALL_UNITS } from '../lib/units.js'
import { RESEARCH, researchCost, researchTime } from '../lib/research.js'
import { ECONOMY_SPEED } from '../lib/config.js'
import { calcDistance, calcDuration } from '../lib/speed.js'
import { getSettings, setSetting } from '../lib/settings.js'
import {
  UNIT_KEYS, UNIT_COSTS, UNIT_COMBAT_SET, UNIT_SUPPORT_SET, UNIT_DEFENSE_SET,
  UNIT_PRIORITY, BUILD_WEIGHTS, ATTACK_THRESHOLD, MILESTONE_ORDER,
  npcPersonality, npcClass,
  isSleepTime, getNpcDelay, getTargetLevels, getTickFlavor, calcEnergyBalance,
  EMPTY_RESEARCH,
} from '../lib/npc-engine.js'

// ── DB helpers ────────────────────────────────────────────────────────────────

// kingdom.userId is the NPC's own user ID — npcState PK is userId
async function setDecision(kingdom, msg) {
  await db.update(npcState)
    .set({ lastDecision: msg, updatedAt: new Date() })
    .where(eq(npcState.userId, kingdom.userId))
}

async function getIncomingAttack(kingdom, now) {
  const rows = await db.select({ id: armyMissions.id, arrivalTime: armyMissions.arrivalTime })
    .from(armyMissions)
    .where(and(
      eq(armyMissions.missionType,  'attack'),
      eq(armyMissions.state,        'active'),
      eq(armyMissions.targetRealm,  kingdom.realm),
      eq(armyMissions.targetRegion, kingdom.region),
      eq(armyMissions.targetSlot,   kingdom.slot),
      gte(armyMissions.arrivalTime, now + 600),
    ))
    .limit(1)
  return rows[0] ?? null
}

// ── Research queue ────────────────────────────────────────────────────────────

// Completes the current research and updates in-memory objects.
async function completeNpcResearch(kingdom, researchMap) {
  const researchId = kingdom.currentResearch
  if (!researchId) return

  const currentLevel = researchMap[researchId] ?? 0
  const newLevel = currentLevel + 1

  // Write to unified research table (by userId)
  await upsertResearch(kingdom.userId, researchId, newLevel)

  // Clear npcState research queue
  await db.update(npcState).set({
    currentResearch:     null,
    researchAvailableAt: null,
    lastDecision: `Investigación completada: ${researchId} lv${newLevel}`,
    updatedAt: new Date(),
  }).where(eq(npcState.userId, kingdom.userId))

  // Update in-memory
  researchMap[researchId]       = newLevel
  kingdom.currentResearch       = null
  kingdom.researchAvailableAt   = null
}

// Queues research for researchId. Chains through prerequisites automatically.
// depth prevents infinite loops in deeply nested tech trees.
async function attemptResearch(kingdom, researchId, researchMap, cfg, now, depth = 0) {
  if (depth > 6) {
    await setDecision(kingdom, `Cadena de investigación demasiado profunda: ${researchId}`)
    return { action: 'error' }
  }

  // Already researching something different — wait
  if (kingdom.currentResearch && kingdom.currentResearch !== researchId) {
    await setDecision(kingdom, `Investigación en curso: ${kingdom.currentResearch}`)
    return { action: 'research_busy' }
  }

  const def = RESEARCH.find(r => r.id === researchId)
  if (!def) return { action: 'error' }

  // Check prerequisites — chain to blockers first
  for (const req of def.requires ?? []) {
    if (req.type === 'building') {
      if ((kingdom[req.id] ?? 0) < req.level) {
        return await attemptBuild(
          kingdom, req.id, cfg, now,
          `Requisito para investigar ${researchId}: ${req.id} lv${req.level}`,
        )
      }
    } else if (req.type === 'research') {
      if ((researchMap[req.id] ?? 0) < req.level) {
        return await attemptResearch(kingdom, req.id, researchMap, cfg, now, depth + 1)
      }
    }
  }

  const currentLevel = researchMap[researchId] ?? 0
  const cost = researchCost(def, currentLevel)

  if (kingdom.wood < cost.wood || kingdom.stone < cost.stone || kingdom.grain < (cost.grain ?? 0)) {
    const d = `Ahorrando para investigar ${researchId} lv${currentLevel + 1} ` +
      `(faltan: ${Math.max(0, cost.wood - kingdom.wood).toFixed(0)}m ` +
      `${Math.max(0, cost.stone - kingdom.stone).toFixed(0)}p)`
    await setDecision(kingdom, d)
    return { action: 'saving', research: researchId }
  }

  const speed     = parseFloat(cfg.economy_speed ?? ECONOMY_SPEED)
  const cls       = npcClass(kingdom)
  const timeSecs  = researchTime(cost.wood, cost.stone, kingdom.academy ?? 0, speed)
  // Discoverer class researches faster
  const timeBonus = cls === 'discoverer' ? 0.75 : 1.0
  const finalTime = Math.max(30, Math.floor(timeSecs * timeBonus))

  const newWood  = kingdom.wood  - cost.wood
  const newStone = kingdom.stone - cost.stone
  const newGrain = kingdom.grain - (cost.grain ?? 0)

  await db.update(kingdoms).set({
    wood:               newWood,
    stone:              newStone,
    grain:              newGrain,
    lastResourceUpdate: now,
    updatedAt:          new Date(),
  }).where(eq(kingdoms.id, kingdom.id))

  await db.update(npcState).set({
    currentResearch:     researchId,
    researchAvailableAt: now + finalTime,
    lastDecision: `Investigando ${researchId} lv${currentLevel + 1} (${Math.round(finalTime / 60)} min)`,
    updatedAt: new Date(),
  }).where(eq(npcState.userId, kingdom.userId))

  // Update in-memory kingdom so cascade knows the queue is now busy
  kingdom.wood               = newWood
  kingdom.stone              = newStone
  kingdom.grain              = newGrain
  kingdom.currentResearch    = researchId
  kingdom.researchAvailableAt = now + finalTime

  return { action: 'researching', research: researchId }
}

// ── Fleetsave ─────────────────────────────────────────────────────────────────

async function attemptFleetsave(kingdom, cfg, now, incomingAttack) {
  const existing = await db.select({ id: armyMissions.id }).from(armyMissions).where(and(
    eq(armyMissions.missionType, 'expedition'),
    eq(armyMissions.startRealm,  kingdom.realm),
    eq(armyMissions.startRegion, kingdom.region),
    eq(armyMissions.startSlot,   kingdom.slot),
    or(eq(armyMissions.state, 'active'), eq(armyMissions.state, 'exploring')),
  )).limit(1)
  if (existing.length > 0) {
    await setDecision(kingdom, `Fleetsave ya activo — unidades en camino`)
    return { action: 'fleetsave_already' }
  }

  const force = {}
  let totalSent = 0
  for (const u of UNIT_COMBAT_SET) {
    const n = kingdom[u] ?? 0
    if (n > 0) { force[u] = n; totalSent += n }
  }
  if (totalSent === 0) {
    await setDecision(kingdom, `Ataque entrante — sin unidades que salvar`)
    return { action: 'no_fleetsave' }
  }

  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const origin = { realm: kingdom.realm, region: kingdom.region, slot: kingdom.slot }
  const dest   = { realm: kingdom.realm, region: kingdom.region, slot: 16 }
  const cls        = npcClass(kingdom)
  const dist       = calcDistance(origin, dest)
  // Fleetsave uses EMPTY_RESEARCH (travel time is safe to under-estimate here)
  const travelSecs = calcDuration(dist, force, 100, universeSpeed, EMPTY_RESEARCH, cls === 'general' ? 'general' : null)
  const arrivalTime = now + travelSecs
  const holdingTime = Math.max(1800, (incomingAttack.arrivalTime - now) + 600)

  // Insert mission with JSONB units field
  await db.insert(armyMissions).values({
    userId:       kingdom.userId,
    missionType:  'expedition',
    state:        'active',
    startRealm:   kingdom.realm,
    startRegion:  kingdom.region,
    startSlot:    kingdom.slot,
    targetRealm:  kingdom.realm,
    targetRegion: kingdom.region,
    targetSlot:   16,
    departureTime: now,
    arrivalTime,
    holdingTime,
    units: force,  // JSONB {squire: 10, knight: 5, ...}
  })

  // Deduct units from units table
  for (const u of Object.keys(force)) {
    await upsertUnit(kingdom.id, u, 0)  // removes unit row (qty <= 0)
    kingdom[u] = 0
  }

  await db.update(npcState).set({
    lastDecision: `Fleetsave: ${totalSent} unidades a zona segura`,
    updatedAt: new Date(),
  }).where(eq(npcState.userId, kingdom.userId))

  return { action: 'fleetsave', units: totalSent }
}

// ── Cascade AI helpers ────────────────────────────────────────────────────────

// Keys that belong to kingdoms table (production/capacity) vs buildings table (levels)
const KINGDOM_PRODUCTION_KEYS = new Set([
  'woodProduction', 'stoneProduction', 'grainProduction',
  'woodCapacity', 'stoneCapacity', 'grainCapacity',
])

async function attemptBuild(kingdom, buildingId, cfg, now, reason) {
  const def = BUILDINGS.find(b => b.id === buildingId)
  if (!def) return { action: 'error', building: buildingId }

  if (def.requires?.length) {
    const missingReq = def.requires.find(req =>
      req.type === 'building' && (kingdom[req.id] ?? 0) < req.level
    )
    if (missingReq) {
      return await attemptBuild(
        kingdom, missingReq.id, cfg, now,
        `Requisito para ${buildingId}: necesita ${missingReq.id} lv${missingReq.level}`,
      )
    }
  }

  const currentLv = kingdom[buildingId] ?? 0
  const nextLv    = currentLv + 1
  const cost      = buildCost(def.woodBase, def.stoneBase, def.factor, currentLv, def.grainBase ?? 0)

  if (kingdom.wood < cost.wood || kingdom.stone < cost.stone || kingdom.grain < (cost.grain ?? 0)) {
    const d = `Ahorrando para ${buildingId} lv${nextLv} ` +
      `(faltan: ${Math.max(0, cost.wood - kingdom.wood).toFixed(0)}m ` +
      `${Math.max(0, cost.stone - kingdom.stone).toFixed(0)}p)`
    await setDecision(kingdom, d)
    return { action: 'saving', building: buildingId }
  }

  const newWood  = kingdom.wood  - cost.wood
  const newStone = kingdom.stone - cost.stone
  const newGrain = kingdom.grain - (cost.grain ?? 0)
  const effect   = applyBuildingEffect(buildingId, nextLv, kingdom)

  const cls       = npcClass(kingdom)
  const isBoss    = kingdom.isBoss ?? false
  const speed     = parseFloat(cfg.economy_speed ?? ECONOMY_SPEED)
  const rawTime   = buildTime(cost.wood, cost.stone, nextLv, kingdom.workshop ?? 0, kingdom.engineersGuild ?? 0, speed)
  const timeBonus = isBoss ? 0.5 : (cls === 'discoverer' ? 0.75 : 1.0)

  // Split effect: production/capacity keys → kingdoms table; building level → buildings table
  const kingdomPatch = {
    wood: newWood, stone: newStone, grain: newGrain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }
  for (const [k, v] of Object.entries(effect)) {
    if (KINGDOM_PRODUCTION_KEYS.has(k)) kingdomPatch[k] = v
  }

  await db.update(kingdoms).set(kingdomPatch).where(eq(kingdoms.id, kingdom.id))

  // Update building level in normalized buildings table
  await upsertBuilding(kingdom.id, buildingId, nextLv)

  // Update npcState for build timer
  await db.update(npcState).set({
    buildAvailableAt: now + Math.max(30, Math.floor(rawTime * timeBonus)),
    lastDecision:     reason,
    updatedAt:        new Date(),
  }).where(eq(npcState.userId, kingdom.userId))

  // Update in-memory so cascade logic sees updated values
  kingdom.wood  = newWood
  kingdom.stone = newStone
  kingdom.grain = newGrain
  Object.assign(kingdom, effect)
  kingdom.buildAvailableAt = now + Math.max(30, Math.floor(rawTime * timeBonus))

  return { action: 'built', building: buildingId, level: nextLv }
}

// Trains the highest-priority unit whose requirements are met.
// If the first eligible unit needs research it doesn't have, queues that research.
async function attemptTrainTroops(kingdom, personality, cls, researchMap, cfg, now) {
  const costMult     = cls === 'general' ? 0.9 : 1.0
  const maxUnitTypes = cls === 'general' ? 2 : 1
  const batchCap     = 50

  const combatTotal    = [...UNIT_COMBAT_SET].reduce((s, u) => s + (kingdom[u] ?? 0), 0)
  const needMoreCombat = combatTotal < ATTACK_THRESHOLD[personality]

  let { wood, stone, grain } = kingdom
  const patch = {}
  let totalTrained     = 0
  let lastUnit         = ''
  let unitTypesTrained = 0
  let firstAffordable  = null

  for (const unitId of UNIT_PRIORITY[personality]) {
    if (unitTypesTrained >= maxUnitTypes) break

    const unitDef = ALL_UNITS.find(u => u.id === unitId)
    if (!unitDef) continue

    // Skip defenses/support while below combat threshold
    if ((UNIT_DEFENSE_SET.has(unitId) || UNIT_SUPPORT_SET.has(unitId)) && needMoreCombat) continue

    let blockedByBuilding = false
    let missingResearch   = null

    for (const req of unitDef.requires ?? []) {
      if (req.type === 'building' && (kingdom[req.id] ?? 0) < req.level) {
        blockedByBuilding = true; break
      }
      if (req.type === 'research' && (researchMap[req.id] ?? 0) < req.level) {
        missingResearch = req.id; break
      }
    }

    if (blockedByBuilding) continue

    // Research missing: set it as current priority and stop
    if (missingResearch) {
      return await attemptResearch(kingdom, missingResearch, researchMap, cfg, now)
    }

    const cost = UNIT_COSTS[unitId]
    if (!cost) continue

    const effWood  = Math.ceil(cost.wood  * costMult)
    const effStone = Math.ceil(cost.stone * costMult)
    const effGrain = Math.ceil((cost.grain ?? 0) * costMult)

    if (!firstAffordable) firstAffordable = { unitId, effWood, effStone }

    if (effWood > wood || effStone > stone || effGrain > grain) continue

    const canAfford = Math.min(
      effWood  > 0 ? Math.floor(wood  / effWood)  : Infinity,
      effStone > 0 ? Math.floor(stone / effStone) : Infinity,
      effGrain > 0 ? Math.floor(grain / effGrain) : Infinity,
    )
    if (canAfford <= 0) continue

    const batch = Math.min(canAfford, batchCap)
    wood  -= effWood  * batch
    stone -= effStone * batch
    grain -= effGrain * batch
    patch[unitId] = (kingdom[unitId] ?? 0) + batch
    totalTrained  += batch
    lastUnit       = unitId
    unitTypesTrained++
  }

  if (totalTrained === 0) {
    const target = firstAffordable
      ? `${firstAffordable.unitId} ` +
        `(faltan: ${Math.max(0, firstAffordable.effWood - kingdom.wood).toFixed(0)}m ` +
        `${Math.max(0, firstAffordable.effStone - kingdom.stone).toFixed(0)}p)`
      : `${UNIT_PRIORITY[personality][0]} (sin requisitos)`
    await setDecision(kingdom, `Ahorrando para ${target}`)
    return { action: 'saving' }
  }

  // Deduct resources from kingdoms table
  await db.update(kingdoms).set({
    wood, stone, grain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, kingdom.id))

  // Upsert each trained unit type in units table
  for (const [unitId, newCount] of Object.entries(patch)) {
    await upsertUnit(kingdom.id, unitId, newCount)
    kingdom[unitId] = newCount
  }

  kingdom.wood  = wood
  kingdom.stone = stone
  kingdom.grain = grain

  const d = `Entrenando ${lastUnit} (+${totalTrained})`
  await db.update(npcState).set({
    lastDecision: d,
    updatedAt: new Date(),
  }).where(eq(npcState.userId, kingdom.userId))

  return {
    action:    'trained',
    unit:      lastUnit,
    count:     totalTrained,
    isCombat:  UNIT_COMBAT_SET.has(lastUnit),
    isSupport: UNIT_SUPPORT_SET.has(lastUnit),
    isDefense: UNIT_DEFENSE_SET.has(lastUnit),
  }
}

async function attemptBuildWeighted(kingdom, personality, cfg, now) {
  const weights = BUILD_WEIGHTS[personality]

  const candidates = Object.entries(weights)
    .map(([id, weight]) => {
      const def = BUILDINGS.find(x => x.id === id)
      if (!def) return null
      return { id, def, score: (kingdom[id] ?? 0) / weight }
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)

  for (const { id, def } of candidates) {
    if (def.requires?.length) {
      const blocked = def.requires.some(req =>
        req.type === 'building' && (kingdom[req.id] ?? 0) < req.level
      )
      if (blocked) continue
    }

    const currentLv = kingdom[id] ?? 0
    const nextLv    = currentLv + 1
    const cost      = buildCost(def.woodBase, def.stoneBase, def.factor, currentLv, def.grainBase ?? 0)

    if (kingdom.wood < cost.wood || kingdom.stone < cost.stone || kingdom.grain < (cost.grain ?? 0)) {
      await setDecision(kingdom, `Ahorrando para ${id} lv${nextLv}`)
      return { action: 'saving', building: id }
    }

    return await attemptBuild(kingdom, id, cfg, now, `Crecimiento: ${id} → lv${nextLv}`)
  }

  await setDecision(kingdom, 'Sin edificios disponibles (bloqueados por requisitos)')
  return { action: 'blocked' }
}

// ── Boss growth ───────────────────────────────────────────────────────────────

async function growNpcBoss(kingdom, cfg, now, researchMap) {
  if (now < (kingdom.buildAvailableAt ?? 0)) return { action: 'waiting' }
  const result = await attemptTrainTroops(kingdom, 'military', 'general', researchMap, cfg, now)
  if (result.action === 'trained') return result
  return await attemptBuildWeighted(kingdom, 'military', cfg, now)
}

// ── Cascade state machine ─────────────────────────────────────────────────────

async function growNpc(kingdom, cfg, now, researchMap) {
  if (kingdom.isBoss) return await growNpcBoss(kingdom, cfg, now, researchMap)

  const personality = npcPersonality(kingdom)
  const cls         = npcClass(kingdom)

  // Nivel -1: fleetsave defensivo
  const incomingAttack = await getIncomingAttack(kingdom, now)
  if (incomingAttack) {
    const sleeping = isSleepTime(now)
    if (!sleeping || Math.random() < 0.5) {
      return await attemptFleetsave(kingdom, cfg, now, incomingAttack)
    }
    await setDecision(kingdom, `Ataque entrante ignorado — comandante durmiendo`)
    return { action: 'sleeping' }
  }

  // Nivel 0-A: cola de construcción ocupada
  const buildAvailable = kingdom.buildAvailableAt ?? 0
  if (now < buildAvailable) {
    const minsLeft = Math.ceil((buildAvailable - now) / 60)
    await setDecision(kingdom, `En cola de construcción (${minsLeft} min)`)
    return { action: 'waiting' }
  }

  // Nivel 0-R: cola de investigación
  if (kingdom.currentResearch) {
    if (now >= (kingdom.researchAvailableAt ?? 0)) {
      await completeNpcResearch(kingdom, researchMap)
      // Fall through — research just completed, take next action this tick
    } else {
      const minsLeft = Math.ceil(((kingdom.researchAvailableAt ?? now) - now) / 60)
      await setDecision(kingdom, `Investigando ${kingdom.currentResearch} (${minsLeft} min)`)
      return { action: 'researching' }
    }
  }

  // Nivel 0-B: supervivencia — energía negativa
  const energyBalance = calcEnergyBalance(kingdom)
  if (energyBalance < 0) {
    return await attemptBuild(
      kingdom, 'windmill', cfg, now,
      `Energía negativa (${energyBalance.toFixed(0)}): subir molino`,
    )
  }

  // Nivel 0-C: supervivencia — almacén al 90%
  const storageChecks = [
    { res: 'wood',  store: 'granary',    cap: 'woodCapacity'  },
    { res: 'stone', store: 'stonehouse', cap: 'stoneCapacity' },
    { res: 'grain', store: 'silo',       cap: 'grainCapacity' },
  ]
  for (const { res, store, cap } of storageChecks) {
    if ((kingdom[res] ?? 0) >= (kingdom[cap] ?? 10000) * 0.9) {
      return await attemptBuild(kingdom, store, cfg, now, `Almacén ${res} al 90%: subir ${store}`)
    }
  }

  // Nivel 1: hitos de personalidad
  const createdAtSec = kingdom.createdAt
    ? Math.floor(new Date(kingdom.createdAt).getTime() / 1000)
    : now
  const ageHours = (now - createdAtSec) / 3600
  const targets  = getTargetLevels(personality, ageHours)

  for (const buildId of MILESTONE_ORDER) {
    const targetLv  = targets[buildId] ?? 0
    const currentLv = kingdom[buildId] ?? 0
    if (currentLv < targetLv) {
      return await attemptBuild(
        kingdom, buildId, cfg, now,
        `Hito: ${buildId} → lv${targetLv} (actual: ${currentLv})`,
      )
    }
  }

  // Nivel 2: gasto de personalidad post-hitos
  const flavor = getTickFlavor(personality, kingdom, ageHours)
  if (flavor === 'troops') {
    return await attemptTrainTroops(kingdom, personality, cls, researchMap, cfg, now)
  } else {
    return await attemptBuildWeighted(kingdom, personality, cfg, now)
  }
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

  // Batch load all NPC kingdoms with their npcState in one query
  const npcRows = await db.select({ k: kingdoms, ns: npcState })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .leftJoin(npcState, eq(npcState.userId, users.id))
    .where(eq(users.role, 'npc'))

  if (npcRows.length === 0) return res.json({ ok: true, skipped: 'no_npc_kingdoms' })

  const npcKingdomIds = npcRows.map(r => r.k.id)
  const npcUserIds    = npcRows.map(r => r.k.userId)

  // Batch load buildings, units, research — avoids N+1 queries
  const [allBuildings, allUnits, allResearch] = await Promise.all([
    db.select().from(buildings).where(inArray(buildings.kingdomId, npcKingdomIds)),
    db.select().from(units).where(inArray(units.kingdomId, npcKingdomIds)),
    db.select().from(research).where(inArray(research.userId, npcUserIds)),
  ])

  // Build per-kingdom / per-user lookup maps
  const buildingsByKingdom = {}
  for (const b of allBuildings) {
    if (!buildingsByKingdom[b.kingdomId]) buildingsByKingdom[b.kingdomId] = {}
    buildingsByKingdom[b.kingdomId][b.type] = b.level
  }

  const unitsByKingdom = {}
  for (const u of allUnits) {
    if (!unitsByKingdom[u.kingdomId]) unitsByKingdom[u.kingdomId] = {}
    unitsByKingdom[u.kingdomId][u.type] = u.quantity
  }

  const researchByUser = {}
  for (const r of allResearch) {
    if (!researchByUser[r.userId]) researchByUser[r.userId] = {}
    researchByUser[r.userId][r.type] = r.level
  }

  // Enrich NPC kingdoms — merge buildings, units, and npcState fields into a single object
  const allNpcKingdoms = npcRows.map(({ k, ns }) => ({
    ...k,
    ...(buildingsByKingdom[k.id] ?? {}),
    ...(unitsByKingdom[k.id]    ?? {}),
    // NPC AI state fields (from npc_state, using new column names):
    isBoss:              ns?.isBoss              ?? false,
    npcLevel:            ns?.npcLevel            ?? 1,
    buildAvailableAt:    ns?.buildAvailableAt    ?? null,
    nextCheck:           ns?.nextCheck           ?? null,
    currentResearch:     ns?.currentResearch     ?? null,
    researchAvailableAt: ns?.researchAvailableAt ?? null,
    lastAttackAt:        ns?.lastAttackAt        ?? 0,
    lastDecision:        ns?.lastDecision        ?? null,
  }))

  // Only process NPCs whose check window has expired
  const npcsDue = allNpcKingdoms.filter(k => !k.nextCheck || k.nextCheck <= now)

  let ticked = 0, builtBuilding = 0, trainedCombat = 0, trainedDefense = 0, trainedSupport = 0
  let saved = 0, waiting = 0, fleetsaved = 0, sleeping = 0, researching = 0

  for (const kingdom of npcsDue) {
    try {
      const cls        = npcClass(kingdom)
      const tickResult = applyResourceTick(kingdom, cfg, cls === 'collector' ? 'collector' : null)

      if (
        tickResult.wood  !== kingdom.wood ||
        tickResult.stone !== kingdom.stone ||
        tickResult.grain !== kingdom.grain
      ) {
        await db.update(kingdoms).set({
          wood:               tickResult.wood,
          stone:              tickResult.stone,
          grain:              tickResult.grain,
          lastResourceUpdate: now,
          updatedAt:          new Date(),
        }).where(eq(kingdoms.id, kingdom.id))
        kingdom.wood               = tickResult.wood
        kingdom.stone              = tickResult.stone
        kingdom.grain              = tickResult.grain
        kingdom.lastResourceUpdate = now
        ticked++
      }

      // Use pre-loaded research map for this NPC's userId
      const researchMap = { ...EMPTY_RESEARCH, ...(researchByUser[kingdom.userId] ?? {}) }

      const growResult = await growNpc(kingdom, cfg, now, researchMap)
      if (growResult?.action === 'built')     builtBuilding++
      if (growResult?.action === 'trained') {
        if (growResult.isCombat)  trainedCombat++
        if (growResult.isSupport) trainedSupport++
        if (growResult.isDefense) trainedDefense++
      }
      if (growResult?.action === 'saving')    saved++
      if (growResult?.action === 'waiting')   waiting++
      if (growResult?.action === 'fleetsave') fleetsaved++
      if (growResult?.action === 'sleeping')  sleeping++
      if (growResult?.action === 'researching') researching++

      const delay = getNpcDelay(now)
      const nextCheck = (growResult?.action === 'waiting')
        ? Math.min(now + delay, (kingdom.buildAvailableAt ?? now) + 60)
        : (growResult?.action === 'researching')
          ? Math.min(now + delay, (kingdom.researchAvailableAt ?? now) + 60)
          : now + delay

      await db.update(npcState)
        .set({ nextCheck, updatedAt: new Date() })
        .where(eq(npcState.userId, kingdom.userId))
    } catch (err) {
      console.error(`[npc-builder] kingdom ${kingdom.id} error:`, err?.message ?? err)
    }
  }

  // Persist tick result for admin monitor
  const tickResult = {
    at: now,
    npcCount: allNpcKingdoms.length, processed: npcsDue.length, ticked,
    builtBuilding, trainedCombat, trainedDefense, trainedSupport,
    saved, waiting, fleetsaved, sleeping,
    attacked: 0, scavenged: 0, expeditioned: 0,
    npcExpeditionsResolved: 0, npcVsNpcResolved: 0, purged: 0,
  }
  const MAX_HISTORY = 48
  let history = []
  try {
    const raw = cfg.npc_tick_history
    if (raw) history = JSON.parse(raw)
  } catch { history = [] }
  history.push(tickResult)
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY)
  await Promise.all([
    setSetting('npc_last_tick',    JSON.stringify(tickResult)),
    setSetting('npc_tick_history', JSON.stringify(history)),
  ])

  return res.json({ ok: true, ...tickResult, researching })
}
