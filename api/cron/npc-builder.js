/**
 * npc-builder — resource tick + cascade growth AI for NPC kingdoms.
 * Vercel Cron: every minute ("* * * * *").
 * Only processes NPCs whose nextCheck has expired (staggered 8–12 min windows).
 *
 * Schema: normalized — buildings/units/research are separate tables.
 * NPC AI state lives in npc_state (PK: userId), not in kingdoms.
 */
import { eq, and, gte, or, inArray } from 'drizzle-orm'
import { db, users, kingdoms, npcState, buildings, units, research, armyMissions, debrisFields } from '../_db.js'
import { upsertBuilding, upsertUnit, upsertResearch } from '../lib/db-helpers.js'
import { applyResourceTick } from '../lib/tick.js'
import {
  BUILDINGS, buildCost, buildTime, applyBuildingEffect,
} from '../lib/buildings.js'
import { ALL_UNITS, unitBuildTime } from '../lib/units.js'
import { RESEARCH, researchCost, researchTime } from '../lib/research.js'
import { ECONOMY_SPEED, UNIVERSE } from '../lib/config.js'
import { calcDistance, calcDuration } from '../lib/speed.js'
import { getSettings, setSetting } from '../lib/settings.js'
import {
  UNIT_KEYS, UNIT_COSTS, UNIT_COMBAT_SET, UNIT_SUPPORT_SET, UNIT_DEFENSE_SET,
  UNIT_PRIORITY, BUILD_WEIGHTS, ATTACK_THRESHOLD, MILESTONE_ORDER,
  RESEARCH_PRIORITY, RESEARCH_TARGETS,
  npcPersonality, npcClass,
  isSleepTime, getNpcDelay, getTargetLevels, getTickFlavor, calcEnergyBalance,
  totalArmy, EMPTY_RESEARCH,
} from '../lib/npc-engine.js'

// ── Esfuerzo de construcción ──────────────────────────────────────────────────
// Builds/trains that take longer than this threshold are deferred: resources
// are consumed immediately but the level/quantity is applied on completion.
const EFFORT_THRESHOLD_SECS = 60   // 1 minute
const NPC_TIME_FACTOR        = 0.9  // NPCs build 10% faster than players

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
          researchMap,
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

  const speed           = parseFloat(cfg.economy_speed ?? ECONOMY_SPEED)
  const cls             = npcClass(kingdom)
  const timeSecs        = researchTime(cost.wood, cost.stone, kingdom.academy ?? 0, speed)
  const classBonus      = cls === 'discoverer' ? 0.75 : 1.0
  const npcResearchTime = Math.max(1, Math.floor(timeSecs * NPC_TIME_FACTOR * classBonus))

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
  kingdom.wood  = newWood
  kingdom.stone = newStone
  kingdom.grain = newGrain

  if (npcResearchTime <= EFFORT_THRESHOLD_SECS) {
    // Instant research — low-level or fast path
    const newLevel = currentLevel + 1
    await upsertResearch(kingdom.userId, researchId, newLevel)
    await db.update(npcState).set({
      lastDecision: `Investigado: ${researchId} lv${newLevel} (instantáneo)`,
      updatedAt: new Date(),
    }).where(eq(npcState.userId, kingdom.userId))
    researchMap[researchId]  = newLevel
    kingdom.currentResearch  = null
    return { action: 'researching' }
  }

  await db.update(npcState).set({
    currentResearch:     researchId,
    researchAvailableAt: now + npcResearchTime,
    lastDecision: `Investigando ${researchId} lv${currentLevel + 1} (${Math.round(npcResearchTime / 60)} min)`,
    updatedAt: new Date(),
  }).where(eq(npcState.userId, kingdom.userId))

  // Update in-memory kingdom so cascade knows the queue is now busy
  kingdom.currentResearch    = researchId
  kingdom.researchAvailableAt = now + npcResearchTime

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
  // Save combat units and support units (caravans, merchants, scouts, colonist)
  const fleetsaveKeys = [...UNIT_COMBAT_SET, ...UNIT_SUPPORT_SET, 'colonist']
  for (const u of fleetsaveKeys) {
    const n = kingdom[u] ?? 0
    if (n > 0) { force[u] = n; totalSent += n }
  }
  if (totalSent === 0) {
    await setDecision(kingdom, `Ataque entrante — sin unidades que salvar`)
    return { action: 'no_fleetsave' }
  }

  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const origin = { realm: kingdom.realm, region: kingdom.region, slot: kingdom.slot }
  const dest   = { realm: kingdom.realm, region: kingdom.region, slot: UNIVERSE.maxSlot + 1 }
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

// Completes a deferred task (building or unit) once finishAt <= now.
async function completeDeferredTask(kingdom, now) {
  const task = kingdom.currentTask
  if (!task) return

  if (task.type === 'building') {
    const def = BUILDINGS.find(b => b.id === task.targetId)
    if (def) {
      const effect = applyBuildingEffect(task.targetId, task.targetLevel, kingdom)
      await upsertBuilding(kingdom.id, task.targetId, task.targetLevel)
      const kingdomPatch = { updatedAt: new Date() }
      for (const [k, v] of Object.entries(effect)) {
        if (KINGDOM_PRODUCTION_KEYS.has(k)) kingdomPatch[k] = v
      }
      if (Object.keys(kingdomPatch).length > 1) {
        await db.update(kingdoms).set(kingdomPatch).where(eq(kingdoms.id, kingdom.id))
      }
      Object.assign(kingdom, effect)
      kingdom[task.targetId] = task.targetLevel
    }
  } else if (task.type === 'unit') {
    const newCount = (kingdom[task.targetId] ?? 0) + task.quantity
    await upsertUnit(kingdom.id, task.targetId, newCount)
    kingdom[task.targetId] = newCount
  }

  await db.update(npcState).set({
    currentTask:     null,
    buildAvailableAt: now,
    lastDecision:    task.type === 'building'
      ? `Construido: ${task.targetId} lv${task.targetLevel}`
      : `Entrenado: ${task.targetId} ×${task.quantity}`,
    updatedAt: new Date(),
  }).where(eq(npcState.userId, kingdom.userId))

  kingdom.currentTask     = null
  kingdom.buildAvailableAt = now
}

async function attemptBuild(kingdom, buildingId, cfg, now, reason, researchMap = {}) {
  const def = BUILDINGS.find(b => b.id === buildingId)
  if (!def) return { action: 'error', building: buildingId }

  if (def.requires?.length) {
    const missingBuilding = def.requires.find(req =>
      req.type === 'building' && (kingdom[req.id] ?? 0) < req.level
    )
    if (missingBuilding) {
      return await attemptBuild(
        kingdom, missingBuilding.id, cfg, now,
        `Requisito para ${buildingId}: necesita ${missingBuilding.id} lv${missingBuilding.level}`,
        researchMap,
      )
    }
    const missingResearch = def.requires.find(req =>
      req.type === 'research' && (researchMap[req.id] ?? 0) < req.level
    )
    if (missingResearch) {
      return await attemptResearch(kingdom, missingResearch.id, researchMap, cfg, now)
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

  const cls         = npcClass(kingdom)
  const isBoss      = kingdom.isBoss ?? false
  const speed       = parseFloat(cfg.economy_speed ?? ECONOMY_SPEED)
  const rawTime     = buildTime(cost.wood, cost.stone, nextLv, kingdom.workshop ?? 0, kingdom.engineersGuild ?? 0, speed)
  const classBonus  = isBoss ? 0.5 : (cls === 'discoverer' ? 0.75 : 1.0)
  const npcTime     = Math.max(1, Math.floor(rawTime * NPC_TIME_FACTOR * classBonus))

  // Deduct resources in kingdoms table (always — cost is paid upfront)
  const kingdomPatch = {
    wood: newWood, stone: newStone, grain: newGrain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }

  if (npcTime > EFFORT_THRESHOLD_SECS) {
    // Deferred build: pay now, apply level when timer expires
    await db.update(kingdoms).set(kingdomPatch).where(eq(kingdoms.id, kingdom.id))
    await db.update(npcState).set({
      currentTask:      { type: 'building', targetId: buildingId, targetLevel: nextLv, finishAt: now + npcTime },
      buildAvailableAt: now + npcTime,
      lastDecision:     `Ocupado: construyendo ${buildingId} lv${nextLv} (${Math.round(npcTime / 60)} min)`,
      updatedAt:        new Date(),
    }).where(eq(npcState.userId, kingdom.userId))

    kingdom.wood  = newWood
    kingdom.stone = newStone
    kingdom.grain = newGrain
    kingdom.currentTask     = { type: 'building', targetId: buildingId, targetLevel: nextLv, finishAt: now + npcTime }
    kingdom.buildAvailableAt = now + npcTime

    return { action: 'building', building: buildingId, level: nextLv }
  }

  // Instant build (≤ threshold): apply effect and level immediately
  for (const [k, v] of Object.entries(effect)) {
    if (KINGDOM_PRODUCTION_KEYS.has(k)) kingdomPatch[k] = v
  }
  await db.update(kingdoms).set(kingdomPatch).where(eq(kingdoms.id, kingdom.id))
  await upsertBuilding(kingdom.id, buildingId, nextLv)
  await db.update(npcState).set({
    buildAvailableAt: now + npcTime,
    lastDecision:     reason,
    updatedAt:        new Date(),
  }).where(eq(npcState.userId, kingdom.userId))

  kingdom.wood  = newWood
  kingdom.stone = newStone
  kingdom.grain = newGrain
  Object.assign(kingdom, effect)
  kingdom.buildAvailableAt = now + npcTime

  return { action: 'built', building: buildingId, level: nextLv }
}

// Trains the highest-priority unit whose requirements are met.
// If the first eligible unit needs research it doesn't have, queues that research.
async function attemptTrainTroops(kingdom, personality, cls, researchMap, cfg, now, customPriority = null, skipCombatCheck = false) {
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

  const priorityList = customPriority ?? UNIT_PRIORITY[personality]
  for (const unitId of priorityList) {
    if (unitTypesTrained >= maxUnitTypes) break

    const unitDef = ALL_UNITS.find(u => u.id === unitId)
    if (!unitDef) continue

    // Skip defenses/support while below combat threshold
    if ((UNIT_DEFENSE_SET.has(unitId) || UNIT_SUPPORT_SET.has(unitId)) && needMoreCombat && !skipCombatCheck) continue

    let blockedByBuilding = false
    let missingResearch   = null

    for (const req of unitDef.requires ?? []) {
      if (req.type === 'building' && (kingdom[req.id] ?? 0) < req.level) {
        blockedByBuilding = true; break  // building absent → skip unit; RESEARCH_PRIORITY handles research
      }
      if (req.type === 'research' && (researchMap[req.id] ?? 0) < req.level) {
        missingResearch = req.id; break
      }
    }

    if (blockedByBuilding) continue

    // Research missing but building satisfied → queue the research
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

  // Calculate training time for this batch (use the last/main unit trained)
  const speed       = parseFloat(cfg.economy_speed ?? ECONOMY_SPEED)
  const mainUnitDef = ALL_UNITS.find(u => u.id === lastUnit)
  const totalBatch  = patch[lastUnit] ?? totalTrained
  const rawUnitTime = mainUnitDef
    ? unitBuildTime(mainUnitDef.hull, kingdom.barracks ?? 0, kingdom.engineersGuild ?? 0, totalBatch, speed)
    : 0
  const npcUnitTime = Math.max(1, Math.floor(rawUnitTime * NPC_TIME_FACTOR))

  // Deduct resources (always upfront)
  await db.update(kingdoms).set({
    wood, stone, grain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, kingdom.id))
  kingdom.wood  = wood
  kingdom.stone = stone
  kingdom.grain = grain

  if (npcUnitTime > EFFORT_THRESHOLD_SECS && Object.keys(patch).length === 1) {
    // Deferred unit training: pay now, apply quantity on completion
    // Only defer when training a single unit type (simpler state to track)
    await db.update(npcState).set({
      currentTask:      { type: 'unit', targetId: lastUnit, quantity: totalBatch, finishAt: now + npcUnitTime },
      buildAvailableAt: now + npcUnitTime,
      lastDecision:     `Ocupado: entrenando ${lastUnit} ×${totalBatch} (${Math.round(npcUnitTime / 60)} min)`,
      updatedAt:        new Date(),
    }).where(eq(npcState.userId, kingdom.userId))

    kingdom.currentTask      = { type: 'unit', targetId: lastUnit, quantity: totalBatch, finishAt: now + npcUnitTime }
    kingdom.buildAvailableAt = now + npcUnitTime

    return {
      action:    'training',
      unit:      lastUnit,
      count:     totalBatch,
      isCombat:  UNIT_COMBAT_SET.has(lastUnit),
      isSupport: UNIT_SUPPORT_SET.has(lastUnit),
      isDefense: UNIT_DEFENSE_SET.has(lastUnit),
    }
  }

  // Instant train: apply immediately
  for (const [unitId, newCount] of Object.entries(patch)) {
    await upsertUnit(kingdom.id, unitId, newCount)
    kingdom[unitId] = newCount
  }

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

// Minimum count of a defense type before progressing to the next tier.
// Mirrors how troops work: build enough cheap defense, then graduate upward.
const DEFENSE_SOFT_CAP = {
  archer:      20,
  crossbowman: 10,
  moat:        5,
  ballista:    5,
  mageTower:   5,
  palisade:    2,
  catapult:    3,
  trebuchet:   3,
  castleWall:  2,
  dragonCannon: 2,
}

// Trains a batch of defense structures using leftover resources.
// Called as a second pass after attemptTrainTroops — defenses are instant (no queue).
// Only runs when combatTotal >= ATTACK_THRESHOLD so economy-first NPCs build a
// base army before investing in walls.
// Progresses through tiers: once a type hits DEFENSE_SOFT_CAP, the next tick
// skips it and trains the next affordable tier (archer → crossbowman → …)
async function attemptTrainDefenses(kingdom, personality, researchMap) {
  const combatTotal = [...UNIT_COMBAT_SET].reduce((s, u) => s + (kingdom[u] ?? 0), 0)
  if (combatTotal < ATTACK_THRESHOLD[personality]) return { action: 'skipped_defense' }

  const defBatchCap = 5
  const defPriority = (UNIT_PRIORITY[personality] ?? []).filter(u => UNIT_DEFENSE_SET.has(u))

  let { wood, stone, grain } = kingdom
  const patch = {}
  let totalBuilt = 0
  let lastDef = ''

  for (const unitId of defPriority) {
    // Skip this tier if NPC already has enough — graduate to next
    const cap = DEFENSE_SOFT_CAP[unitId] ?? 3
    if ((kingdom[unitId] ?? 0) >= cap) continue

    const unitDef = ALL_UNITS.find(u => u.id === unitId)
    if (!unitDef) continue

    let blocked = false
    for (const req of unitDef.requires ?? []) {
      if (req.type === 'building'  && (kingdom[req.id]     ?? 0) < req.level) { blocked = true; break }
      if (req.type === 'research'  && (researchMap[req.id] ?? 0) < req.level) { blocked = true; break }
    }
    if (blocked) continue

    const cost = UNIT_COSTS[unitId]
    if (!cost) continue
    if (cost.wood > wood || cost.stone > stone || (cost.grain ?? 0) > grain) continue

    const canAfford = Math.min(
      cost.wood  > 0 ? Math.floor(wood  / cost.wood)  : Infinity,
      cost.stone > 0 ? Math.floor(stone / cost.stone) : Infinity,
      (cost.grain ?? 0) > 0 ? Math.floor(grain / cost.grain) : Infinity,
    )
    if (canAfford <= 0) continue

    // Only fill up to the soft cap for this tier
    const stillNeeded = cap - (kingdom[unitId] ?? 0)
    const batch = Math.min(canAfford, defBatchCap, stillNeeded)
    wood  -= cost.wood  * batch
    stone -= cost.stone * batch
    grain -= (cost.grain ?? 0) * batch
    patch[unitId] = (kingdom[unitId] ?? 0) + batch
    totalBuilt += batch
    lastDef = unitId
    break  // one defense tier per tick
  }

  if (totalBuilt === 0) return { action: 'no_defense_affordable' }

  await db.update(kingdoms).set({
    wood, stone, grain,
    lastResourceUpdate: Math.floor(Date.now() / 1000),
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, kingdom.id))
  kingdom.wood  = wood
  kingdom.stone = stone
  kingdom.grain = grain

  for (const [unitId, newCount] of Object.entries(patch)) {
    await upsertUnit(kingdom.id, unitId, newCount)
    kingdom[unitId] = newCount
  }

  // Append defense info to lastDecision without losing the primary action context
  const prevDecision = kingdom.lastDecision ?? ''
  const defNote = `defensa: ${lastDef} ×${totalBuilt}`
  const newDecision = prevDecision && !prevDecision.includes('defensa:')
    ? `${prevDecision} | ${defNote}`
    : defNote
  await db.update(npcState).set({ lastDecision: newDecision, updatedAt: new Date() })
    .where(eq(npcState.userId, kingdom.userId))
  kingdom.lastDecision = newDecision

  return { action: 'defense', unit: lastDef, count: totalBuilt, isDefense: true }
}

async function attemptBuildWeighted(kingdom, personality, cfg, now, researchMap = {}) {
  const weights = BUILD_WEIGHTS[personality]

  const candidates = Object.entries(weights)
    .map(([id, weight]) => {
      const def = BUILDINGS.find(x => x.id === id)
      if (!def) return null
      // Almacenes: solo entran en candidatos si el recurso supera el 70% de capacidad.
      // Bajo ese umbral el almacén está vacío — no tiene sentido bloquear el ahorro en él.
      if (id === 'granary'    && (kingdom.wood  ?? 0) < (kingdom.woodCapacity  ?? 10000) * 0.70) return null
      if (id === 'stonehouse' && (kingdom.stone ?? 0) < (kingdom.stoneCapacity ?? 10000) * 0.70) return null
      if (id === 'silo'       && (kingdom.grain ?? 0) < (kingdom.grainCapacity ?? 10000) * 0.70) return null
      return { id, def, score: (kingdom[id] ?? 0) / weight }
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)

  let bestSaving = null  // highest-priority building we can't yet afford

  for (const { id, def } of candidates) {
    if (def.requires?.length) {
      const blocked = def.requires.some(req =>
        req.type === 'building' ? (kingdom[req.id]     ?? 0) < req.level :
        req.type === 'research' ? (researchMap[req.id] ?? 0) < req.level : false
      )
      if (blocked) continue
    }

    const currentLv = kingdom[id] ?? 0
    const nextLv    = currentLv + 1
    const cost      = buildCost(def.woodBase, def.stoneBase, def.factor, currentLv, def.grainBase ?? 0)

    if (kingdom.wood < cost.wood || kingdom.stone < cost.stone || kingdom.grain < (cost.grain ?? 0)) {
      if (!bestSaving) bestSaving = { id, nextLv }
      continue  // try cheaper alternatives before giving up
    }

    return await attemptBuild(kingdom, id, cfg, now, `Crecimiento: ${id} → lv${nextLv}`, researchMap)
  }

  if (bestSaving) {
    await setDecision(kingdom, `Ahorrando para ${bestSaving.id} lv${bestSaving.nextLv}`)
    return { action: 'saving', building: bestSaving.id }
  }

  await setDecision(kingdom, 'Sin edificios disponibles (bloqueados por requisitos)')
  return { action: 'blocked' }
}

// Proactively advances the highest-priority research that is below its target level.
// Chains prerequisites automatically via attemptResearch.
async function attemptResearchProactive(kingdom, personality, researchMap, cfg, now) {
  const priority = RESEARCH_PRIORITY[personality] ?? RESEARCH_PRIORITY.balanced
  const targets  = RESEARCH_TARGETS[personality]  ?? RESEARCH_TARGETS.balanced

  for (const researchId of priority) {
    const target  = targets[researchId] ?? 0
    if (target === 0) continue
    if ((researchMap[researchId] ?? 0) >= target) continue

    const r = await attemptResearch(kingdom, researchId, researchMap, cfg, now)
    // 'error' → tech not found, skip
    // 'saving' → can't afford yet, continue to next affordable tech
    // anything else (researching, research_busy) → actionable, return
    if (r.action !== 'error' && r.action !== 'saving') return r
  }

  await setDecision(kingdom, 'Sin investigación proactiva pendiente')
  return { action: 'no_research' }
}

// ── Boss growth ───────────────────────────────────────────────────────────────

async function growNpcBoss(kingdom, cfg, now, researchMap) {
  if (kingdom.currentTask) {
    if (now >= kingdom.currentTask.finishAt) {
      await completeDeferredTask(kingdom, now)
    } else {
      const minsLeft = Math.ceil((kingdom.currentTask.finishAt - now) / 60)
      const desc = kingdom.currentTask.type === 'building'
        ? `Ocupado: construyendo ${kingdom.currentTask.targetId} lv${kingdom.currentTask.targetLevel} (${minsLeft} min)`
        : `Ocupado: entrenando ${kingdom.currentTask.targetId} ×${kingdom.currentTask.quantity} (${minsLeft} min)`
      await setDecision(kingdom, desc)
      return { action: 'waiting' }
    }
  } else if (now < (kingdom.buildAvailableAt ?? 0)) {
    return { action: 'waiting' }
  }
  const result = await attemptTrainTroops(kingdom, 'military', 'general', researchMap, cfg, now)
  if (result.action === 'trained') return result
  return await attemptBuildWeighted(kingdom, 'military', cfg, now, researchMap)
}

// ── Cascade state machine ─────────────────────────────────────────────────────

async function growNpc(kingdom, cfg, now, researchMap, debrisRegions, colonizeActiveUsers, kingdomCountByUser) {
  if (kingdom.isBoss) return await growNpcBoss(kingdom, cfg, now, researchMap)

  const personality = npcPersonality(kingdom)
  const cls         = npcClass(kingdom)

  const createdAtSec = kingdom.createdAt
    ? Math.floor(new Date(kingdom.createdAt).getTime() / 1000)
    : now
  const speedFactor = parseFloat(cfg.economy_speed ?? ECONOMY_SPEED)
  const ageHours = (now - createdAtSec) / 3600 * speedFactor

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

  // Nivel 0-A: tarea diferida en progreso
  if (kingdom.currentTask) {
    if (now >= kingdom.currentTask.finishAt) {
      await completeDeferredTask(kingdom, now)
      // Fall through — task just completed, take next action this tick
    } else {
      const minsLeft = Math.ceil((kingdom.currentTask.finishAt - now) / 60)
      const desc = kingdom.currentTask.type === 'building'
        ? `Ocupado: construyendo ${kingdom.currentTask.targetId} lv${kingdom.currentTask.targetLevel} (${minsLeft} min)`
        : `Ocupado: entrenando ${kingdom.currentTask.targetId} ×${kingdom.currentTask.quantity} (${minsLeft} min)`
      await setDecision(kingdom, desc)
      return { action: 'waiting' }
    }
  } else if (now < (kingdom.buildAvailableAt ?? 0)) {
    const minsLeft = Math.ceil(((kingdom.buildAvailableAt ?? 0) - now) / 60)
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
    const rWind = await attemptBuild(
      kingdom, 'windmill', cfg, now,
      `Energía negativa (${energyBalance.toFixed(0)}): subir molino`,
      researchMap,
    )
    if (rWind.action !== 'saving') return rWind
    // Windmill demasiado caro — intentar catedral (attemptBuild verifica alchemy lv3 internamente)
    return await attemptBuild(
      kingdom, 'cathedral', cfg, now,
      `Energía negativa (${energyBalance.toFixed(0)}): subir catedral`,
      researchMap,
    )
    return rWind
  }

  // Nivel 0-C: supervivencia — almacén al 90%
  const storageChecks = [
    { res: 'wood',  store: 'granary',    cap: 'woodCapacity'  },
    { res: 'stone', store: 'stonehouse', cap: 'stoneCapacity' },
    { res: 'grain', store: 'silo',       cap: 'grainCapacity' },
  ]
  for (const { res, store, cap } of storageChecks) {
    if ((kingdom[res] ?? 0) >= (kingdom[cap] ?? 10000) * 0.9) {
      return await attemptBuild(kingdom, store, cfg, now, `Almacén ${res} al 90%: subir ${store}`, researchMap)
    }
  }

  // Nivel 0D: carroñero prioritario — collector/economy con escombros cercanos.
  // Requisitos reales del scavenger: barracks lv4 + horsemanship lv6 + runemastery lv2.
  // Cuando faltan los techs, los empujamos explícitamente en vez de dejar que
  // attemptTrainTroops los cadene; así el planificador de investigación los prioriza.
  if (
    (cls === 'collector' || personality === 'economy') &&
    debrisRegions.has(`${kingdom.realm}:${kingdom.region}`) &&
    (kingdom.scavenger ?? 0) === 0 &&
    (kingdom.barracks  ?? 0) >= 4
  ) {
    if ((researchMap.horsemanship ?? 0) < 6)
      return await attemptResearch(kingdom, 'horsemanship', researchMap, cfg, now)
    if ((researchMap.runemastery  ?? 0) < 2)
      return await attemptResearch(kingdom, 'runemastery',  researchMap, cfg, now)
    const r = await attemptTrainTroops(kingdom, personality, cls, researchMap, cfg, now, ['scavenger'], true)
    if (r.action === 'trained' || r.action === 'researching') return r
  }

  // Nivel 1: hitos de personalidad
  const targets = getTargetLevels(personality, ageHours)

  for (const buildId of MILESTONE_ORDER) {
    const targetLv  = targets[buildId] ?? 0
    const currentLv = kingdom[buildId] ?? 0
    if (currentLv < targetLv) {
      return await attemptBuild(
        kingdom, buildId, cfg, now,
        `Hito: ${buildId} → lv${targetLv} (actual: ${currentLv})`,
        researchMap,
      )
    }
  }

  // Nivel 1.5: colonización — si tiene capacidad y ningún colonizador activo
  if (
    ageHours >= 168 &&
    (kingdom.barracks      ?? 0) >= 4 &&
    (researchMap.cartography ?? 0) >= 3 &&
    (kingdom.colonist      ?? 0) === 0 &&
    !colonizeActiveUsers.has(kingdom.userId) &&
    (kingdomCountByUser[kingdom.userId] ?? 1) < 2
  ) {
    const r = await attemptTrainTroops(kingdom, personality, cls, researchMap, cfg, now, ['colonist'], true)
    if (r.action === 'trained') return r
  }

  // Nivel 2: doble acción por tick — sabor determina la prioridad.
  // research: investigación proactiva → luego edificar con lo que sobre.
  // troops:   entrenar → luego edificar con lo que sobre.
  // buildings: edificar → luego entrenar con lo que sobre.
  const flavor    = getTickFlavor(personality, kingdom, ageHours)
  const hasTroops = (kingdom.barracks ?? 0) >= 1

  let primaryResult, secondaryResult, defenseResult

  if (flavor === 'research') {
    primaryResult = await attemptResearchProactive(kingdom, personality, researchMap, cfg, now)
    if (!kingdom.currentTask) {
      secondaryResult = await attemptBuildWeighted(kingdom, personality, cfg, now, researchMap)
    }
    if (hasTroops) defenseResult = await attemptTrainDefenses(kingdom, personality, researchMap)
  } else if (flavor === 'troops') {
    if (hasTroops) {
      primaryResult = await attemptTrainTroops(kingdom, personality, cls, researchMap, cfg, now)
      defenseResult = await attemptTrainDefenses(kingdom, personality, researchMap)
      // Push combat research alongside troop training — only when no research is running
      // and the NPC has an active army worth boosting.
      if (!kingdom.currentResearch && totalArmy(kingdom) > 0) {
        const combatTechs = ['swordsmanship', 'armoury', 'fortification']
        const combatTargets = RESEARCH_TARGETS[personality] ?? RESEARCH_TARGETS.balanced
        for (const tech of combatTechs) {
          if ((researchMap[tech] ?? 0) < (combatTargets[tech] ?? 0)) {
            await attemptResearch(kingdom, tech, researchMap, cfg, now)
            break
          }
        }
      }
    }
    if (!kingdom.currentTask) {
      secondaryResult = await attemptBuildWeighted(kingdom, personality, cfg, now, researchMap)
    }
  } else {
    primaryResult = await attemptBuildWeighted(kingdom, personality, cfg, now, researchMap)
    if (hasTroops && !kingdom.currentTask) {
      secondaryResult = await attemptTrainTroops(kingdom, personality, cls, researchMap, cfg, now)
    }
    if (hasTroops) defenseResult = await attemptTrainDefenses(kingdom, personality, researchMap)
  }

  const isActive = (r) => r && !['saving', 'blocked', 'waiting', 'error', 'research_busy', 'no_research',
    'skipped_defense', 'no_defense_affordable'].includes(r?.action)
  const builtDefense = defenseResult?.action === 'defense'
  if (isActive(primaryResult))   return { ...primaryResult,   builtDefense }
  if (isActive(secondaryResult)) return { ...secondaryResult, builtDefense }
  return { ...(primaryResult ?? secondaryResult ?? { action: 'saving' }), builtDefense }
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
    currentTask:         ns?.currentTask         ?? null,
    lastAttackAt:        ns?.lastAttackAt        ?? 0,
    lastDecision:        ns?.lastDecision        ?? null,
  }))

  // Preload debris regions (for scavenger priority in growNpc)
  const debrisRows = await db.select({ realm: debrisFields.realm, region: debrisFields.region }).from(debrisFields)
  const debrisRegions = new Set(debrisRows.map(d => `${d.realm}:${d.region}`))

  // Colonize missions active or returning → don't retrain colonist
  const colonizeMissions = npcUserIds.length
    ? await db.select({ userId: armyMissions.userId }).from(armyMissions)
        .where(and(
          inArray(armyMissions.userId, npcUserIds),
          eq(armyMissions.missionType, 'colonize'),
          or(eq(armyMissions.state, 'active'), eq(armyMissions.state, 'returning')),
        ))
    : []
  const colonizeActiveUsers = new Set(colonizeMissions.map(m => m.userId))

  // Count kingdoms per NPC user (to cap colonization at 2 kingdoms)
  const kingdomCountByUser = {}
  for (const { k } of npcRows) {
    kingdomCountByUser[k.userId] = (kingdomCountByUser[k.userId] ?? 0) + 1
  }

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

      const growResult = await growNpc(kingdom, cfg, now, researchMap, debrisRegions, colonizeActiveUsers, kingdomCountByUser)
      if (growResult?.action === 'built' || growResult?.action === 'building') builtBuilding++
      if (growResult?.action === 'trained' || growResult?.action === 'training') {
        if (growResult.isCombat)  trainedCombat++
        if (growResult.isSupport) trainedSupport++
      }
      if ((growResult?.action === 'trained' || growResult?.action === 'training') && growResult?.isDefense || growResult?.builtDefense) {
        trainedDefense++
      }
      if (growResult?.action === 'saving')    saved++
      if (growResult?.action === 'waiting')   waiting++
      if (growResult?.action === 'fleetsave') fleetsaved++
      if (growResult?.action === 'sleeping')  sleeping++
      if (growResult?.action === 'researching') researching++

      const delay = getNpcDelay(now)
      // For deferred tasks, schedule next check at finishAt so completion is detected promptly
      const nextCheck =
        (growResult?.action === 'waiting' || growResult?.action === 'building' || growResult?.action === 'training')
          ? kingdom.currentTask
            ? kingdom.currentTask.finishAt               // process the tick when the task finishes
            : Math.min(now + delay, (kingdom.buildAvailableAt ?? now) + 60)
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
    saved, waiting, researching, fleetsaved, sleeping,
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
