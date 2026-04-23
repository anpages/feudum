/**
 * npc-builder — resource tick + cascade growth AI for NPC kingdoms.
 * Vercel Cron: every minute ("* * * * *").
 * Only processes NPCs whose npcNextCheck has expired (staggered 8–12 min windows).
 */
import { eq, and, gte, or } from 'drizzle-orm'
import { db, users, kingdoms, armyMissions } from '../_db.js'
import { applyResourceTick } from '../lib/tick.js'
import {
  BUILDINGS, buildCost, buildTime, applyBuildingEffect,
} from '../lib/buildings.js'
import { ALL_UNITS } from '../lib/units.js'
import { ECONOMY_SPEED } from '../lib/config.js'
import { calcDistance, calcDuration } from '../lib/speed.js'
import { getSettings, setSetting } from '../lib/settings.js'
import {
  UNIT_KEYS, UNIT_COSTS, UNIT_COMBAT_SET, UNIT_SUPPORT_SET, UNIT_DEFENSE_SET,
  UNIT_PRIORITY, BUILD_WEIGHTS, ATTACK_THRESHOLD, MILESTONES, MILESTONE_ORDER,
  npcPersonality, npcClass, npcResearch,
  isSleepTime, getNpcDelay, getTargetLevels, getTickFlavor, calcEnergyBalance,
} from '../lib/npc-engine.js'

// ── DB helpers (need db access — not in npc-engine.js) ────────────────────────

async function setDecision(kingdomId, msg) {
  await db.update(kingdoms)
    .set({ lastDecision: msg, updatedAt: new Date() })
    .where(eq(kingdoms.id, kingdomId))
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
    await setDecision(kingdom.id, `Fleetsave ya activo — unidades en camino`)
    return { action: 'fleetsave_already' }
  }

  const force = {}
  let totalSent = 0
  for (const u of UNIT_COMBAT_SET) {
    const n = kingdom[u] ?? 0
    if (n > 0) { force[u] = n; totalSent += n }
  }
  if (totalSent === 0) {
    await setDecision(kingdom.id, `Ataque entrante — sin unidades que salvar`)
    return { action: 'no_fleetsave' }
  }

  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const origin = { realm: kingdom.realm, region: kingdom.region, slot: kingdom.slot }
  const dest   = { realm: kingdom.realm, region: kingdom.region, slot: 16 }
  const dist       = calcDistance(origin, dest)
  const cls        = npcClass(kingdom)
  const research   = npcResearch(kingdom)
  const travelSecs = calcDuration(dist, force, 100, universeSpeed, research, cls === 'general' ? 'general' : null)
  const arrivalTime = now + travelSecs
  const holdingTime = Math.max(1800, (incomingAttack.arrivalTime - now) + 600)

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
    ...force,
  })

  const deduct = { lastDecision: `Fleetsave: ${totalSent} unidades a zona segura`, updatedAt: new Date() }
  for (const u of Object.keys(force)) deduct[u] = 0
  await db.update(kingdoms).set(deduct).where(eq(kingdoms.id, kingdom.id))

  return { action: 'fleetsave', units: totalSent }
}

// ── Cascade AI helpers ────────────────────────────────────────────────────────

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
        `Requisito para ${buildingId}: necesita ${missingReq.id} lv${missingReq.level}`
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
    await setDecision(kingdom.id, d)
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

  await db.update(kingdoms).set({
    ...effect,
    wood: newWood, stone: newStone, grain: newGrain,
    npcBuildAvailableAt: now + Math.max(30, Math.floor(rawTime * timeBonus)),
    lastDecision: reason,
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, kingdom.id))

  return { action: 'built', building: buildingId, level: nextLv }
}

async function attemptTrainTroops(kingdom, personality, cls) {
  const costMult     = cls === 'general' ? 0.9 : 1.0
  const maxUnitTypes = cls === 'general' ? 2 : 1
  const batchCap     = 50

  const combatTotal    = [...UNIT_COMBAT_SET].reduce((s, u) => s + (kingdom[u] ?? 0), 0)
  const needMoreCombat = combatTotal < ATTACK_THRESHOLD[personality]
  const researchLevels = npcResearch(kingdom)

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

    if (unitDef.requires?.length) {
      const blocked = unitDef.requires.some(req => {
        if (req.type === 'building') return (kingdom[req.id] ?? 0) < req.level
        if (req.type === 'research') return (researchLevels[req.id] ?? 0) < req.level
        return false
      })
      if (blocked) continue
    }

    if ((UNIT_DEFENSE_SET.has(unitId) || UNIT_SUPPORT_SET.has(unitId)) && needMoreCombat) continue

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
    await setDecision(kingdom.id, `Ahorrando para ${target}`)
    return { action: 'saving' }
  }

  const d = `Entrenando ${lastUnit} (+${totalTrained})`
  await db.update(kingdoms).set({
    ...patch, wood, stone, grain,
    lastDecision: d,
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, kingdom.id))

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
      await setDecision(kingdom.id, `Ahorrando para ${id} lv${nextLv}`)
      return { action: 'saving', building: id }
    }

    return await attemptBuild(kingdom, id, cfg, now, `Crecimiento: ${id} → lv${nextLv}`)
  }

  await setDecision(kingdom.id, 'Sin edificios disponibles (bloqueados por requisitos)')
  return { action: 'blocked' }
}

// ── Boss growth ───────────────────────────────────────────────────────────────

async function growNpcBoss(kingdom, cfg, now) {
  if (now < (kingdom.npcBuildAvailableAt ?? 0)) return { action: 'waiting' }
  const result = await attemptTrainTroops(kingdom, 'military', 'general')
  if (result.action === 'trained') return result
  return await attemptBuildWeighted(kingdom, 'military', cfg, now)
}

// ── Cascade state machine ─────────────────────────────────────────────────────

async function growNpc(kingdom, cfg, now) {
  if (kingdom.isBoss) return await growNpcBoss(kingdom, cfg, now)

  const personality = npcPersonality(kingdom)
  const cls         = npcClass(kingdom)

  // Nivel -1: fleetsave defensivo
  const incomingAttack = await getIncomingAttack(kingdom, now)
  if (incomingAttack) {
    const sleeping = isSleepTime(now)
    if (!sleeping || Math.random() < 0.5) {
      return await attemptFleetsave(kingdom, cfg, now, incomingAttack)
    }
    await setDecision(kingdom.id, `Ataque entrante ignorado — comandante durmiendo`)
    return { action: 'sleeping' }
  }

  // Nivel 0-A: cola de construcción ocupada
  const buildAvailable = kingdom.npcBuildAvailableAt ?? 0
  if (now < buildAvailable) {
    const minsLeft = Math.ceil((buildAvailable - now) / 60)
    await setDecision(kingdom.id, `En cola de construcción (${minsLeft} min)`)
    return { action: 'waiting' }
  }

  // Nivel 0-B: supervivencia — energía negativa
  const energyBalance = calcEnergyBalance(kingdom)
  if (energyBalance < 0) {
    return await attemptBuild(
      kingdom, 'windmill', cfg, now,
      `Energía negativa (${energyBalance.toFixed(0)}): subir molino`
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
      return await attemptBuild(
        kingdom, store, cfg, now,
        `Almacén ${res} al 90%: subir ${store}`
      )
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
        `Hito: ${buildId} → lv${targetLv} (actual: ${currentLv})`
      )
    }
  }

  // Nivel 2: gasto de personalidad post-hitos
  const flavor = getTickFlavor(personality, kingdom, ageHours)
  if (flavor === 'troops') {
    return await attemptTrainTroops(kingdom, personality, cls)
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

  const [npcUser] = await db.select({ id: users.id })
    .from(users).where(eq(users.isNpc, true)).limit(1)
  if (!npcUser) return res.json({ ok: true, skipped: 'no_npc_user' })

  const allNpcKingdoms = await db.select().from(kingdoms)
    .where(eq(kingdoms.isNpc, true))

  if (allNpcKingdoms.length === 0) return res.json({ ok: true, skipped: 'no_npc_kingdoms' })

  // Only process NPCs whose window has expired
  const npcsDue = allNpcKingdoms.filter(k => !k.npcNextCheck || k.npcNextCheck <= now)

  let ticked = 0, builtBuilding = 0, trainedCombat = 0, trainedDefense = 0, trainedSupport = 0
  let saved = 0, waiting = 0, fleetsaved = 0, sleeping = 0

  for (const kingdom of npcsDue) {
    try {
      const cls = npcClass(kingdom)
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

      const growResult = await growNpc(kingdom, cfg, now)
      if (growResult?.action === 'built')   builtBuilding++
      if (growResult?.action === 'trained') {
        if (growResult.isCombat)  trainedCombat++
        if (growResult.isSupport) trainedSupport++
        if (growResult.isDefense) trainedDefense++
      }
      if (growResult?.action === 'saving')   saved++
      if (growResult?.action === 'waiting')  waiting++
      if (growResult?.action === 'fleetsave') fleetsaved++
      if (growResult?.action === 'sleeping') sleeping++

      const delay = getNpcDelay(now)
      const nextCheck = (growResult?.action === 'waiting')
        ? Math.min(now + delay, (kingdom.npcBuildAvailableAt ?? now) + 60)
        : now + delay
      await db.update(kingdoms)
        .set({ npcNextCheck: nextCheck })
        .where(eq(kingdoms.id, kingdom.id))
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

  return res.json({ ok: true, ...tickResult })
}
