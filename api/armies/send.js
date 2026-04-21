import { eq, and, gte, ne } from 'drizzle-orm'
import { db, kingdoms, armyMissions, research, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { calcDistance, calcDuration, calcCargoCapacity } from '../lib/speed.js'
import { getSettings } from '../lib/settings.js'
import { applyResourceTick } from '../lib/tick.js'
import { processUserQueues } from '../lib/process-queues.js'

const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

const MISSION_TYPES = ['attack', 'transport', 'spy', 'colonize', 'scavenge', 'deploy', 'expedition', 'missile']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { missionType, target, units: rawUnits, resources: rawResources, holdingHours: rawHoldingHours, speedPct: rawSpeedPct } = req.body ?? {}

  // ── Validate mission type ─────────────────────────────────────────────────
  if (!MISSION_TYPES.includes(missionType)) {
    return res.status(400).json({ error: 'Tipo de misión inválido' })
  }

  // ── Validate target ───────────────────────────────────────────────────────
  const tRealm  = parseInt(target?.realm,  10)
  const tRegion = parseInt(target?.region, 10)
  const tSlot   = parseInt(target?.slot,   10)

  const isExpedition = missionType === 'expedition'
  const maxSlot = isExpedition ? 16 : 15

  if (!tRealm || !tRegion || !tSlot
    || tRealm < 1 || tRealm > 3
    || tRegion < 1 || tRegion > 10
    || tSlot < 1 || tSlot > maxSlot) {
    return res.status(400).json({ error: 'Coordenadas de destino inválidas' })
  }

  if (isExpedition && tSlot !== 16) {
    return res.status(400).json({ error: 'Las expediciones deben dirigirse al slot 16 (Tierras Ignotas)' })
  }

  const isMissile = missionType === 'missile'

  await processUserQueues(userId)

  // ── Load player kingdom + research + class ───────────────────────────────
  const [[kingdom], [researchRow], [userRow], cfg] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    db.select().from(research).where(eq(research.userId, userId)).limit(1),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  // ── Fleet slot limit (Logistics research) — missiles don't use slots ──────
  if (!isMissile) {
    const logistics = researchRow?.logistics ?? 0
    const maxSlots  = 1 + logistics
    const allActive = await db
      .select({ missionType: armyMissions.missionType })
      .from(armyMissions)
      .where(and(eq(armyMissions.userId, userId), ne(armyMissions.state, 'completed')))
    const slotsUsed = allActive.filter(m => m.missionType !== 'missile').length
    if (slotsUsed >= maxSlots) {
      return res.status(400).json({
        error: `Slots de flota llenos (${slotsUsed}/${maxSlots}). Mejora Logística para desbloquear más misiones simultáneas.`,
      })
    }
  }

  // Can't attack yourself
  if (kingdom.realm === tRealm && kingdom.region === tRegion && kingdom.slot === tSlot) {
    return res.status(400).json({ error: 'No puedes enviar ejércitos a tu propio reino' })
  }

  // ── Missile mission — separate validation path ────────────────────────────
  if (isMissile) {
    const cartography = researchRow?.cartography ?? 0
    if (cartography < 1) {
      return res.status(400).json({ error: 'Necesitas al menos Cartografía nivel 1 para lanzar misiles' })
    }
    if (tRealm !== kingdom.realm) {
      return res.status(400).json({ error: 'Los misiles no pueden cruzar reinos' })
    }
    const range = cartography * 5 - 1
    if (Math.abs(tRegion - kingdom.region) > range) {
      return res.status(400).json({ error: `Los misiles no alcanzan ese destino (rango: ${range} regiones)` })
    }

    const ballisticCount = parseInt(rawUnits?.ballistic ?? 0, 10)
    if (ballisticCount <= 0) {
      return res.status(400).json({ error: 'Debes enviar al menos un misil' })
    }
    if (ballisticCount > (kingdom.ballistic ?? 0)) {
      return res.status(400).json({ error: `No tienes suficientes misiles (tienes ${kingdom.ballistic ?? 0})` })
    }

    const now        = Math.floor(Date.now() / 1000)
    const travelSecs = 60 + Math.floor(Math.random() * 60)  // 60–120 s near-instant
    const arrivalTime = now + travelSecs

    const { wood, stone, grain } = applyResourceTick(kingdom, cfg, userRow?.characterClass ?? null, researchRow ?? null)

    await db.update(kingdoms).set({
      ballistic: (kingdom.ballistic ?? 0) - ballisticCount,
      wood, stone, grain,
      lastResourceUpdate: now,
      updatedAt: new Date(),
    }).where(eq(kingdoms.id, kingdom.id))

    const [inserted] = await db.insert(armyMissions).values({
      userId,
      missionType: 'missile',
      state: 'active',
      startRealm:  kingdom.realm,
      startRegion: kingdom.region,
      startSlot:   kingdom.slot,
      targetRealm:  tRealm,
      targetRegion: tRegion,
      targetSlot:   tSlot,
      departureTime: now,
      arrivalTime,
      returnTime: null,
      woodLoad: 0, stoneLoad: 0, grainLoad: 0,
      ballistic: ballisticCount,
    }).returning({ id: armyMissions.id })

    return res.json({ ok: true, missionId: inserted.id, arrivalTime, travelSeconds: travelSecs })
  }

  // ── Parse & validate units ────────────────────────────────────────────────
  const units = {}
  let totalUnits = 0
  for (const k of UNIT_KEYS) {
    const n = parseInt(rawUnits?.[k] ?? 0, 10)
    if (n < 0) return res.status(400).json({ error: `Cantidad inválida para ${k}` })
    if (n > (kingdom[k] ?? 0)) {
      return res.status(400).json({ error: `No tienes suficientes ${k} (tienes ${kingdom[k] ?? 0})` })
    }
    units[k] = n
    totalUnits += n
  }

  if (totalUnits === 0) {
    return res.status(400).json({ error: 'Debes enviar al menos una unidad' })
  }

  // Spy missions: scouts only
  if (missionType === 'spy') {
    const nonScouts = UNIT_KEYS.filter(k => k !== 'scout' && units[k] > 0)
    if (nonScouts.length > 0) {
      return res.status(400).json({ error: 'Las misiones de espionaje solo permiten Exploradores' })
    }
    if (units.scout === 0) {
      return res.status(400).json({ error: 'Necesitas al menos un Explorador para espiar' })
    }
  }

  // Scavenge missions: scavengers only
  if (missionType === 'scavenge') {
    const nonScavengers = UNIT_KEYS.filter(k => k !== 'scavenger' && units[k] > 0)
    if (nonScavengers.length > 0) {
      return res.status(400).json({ error: 'Las misiones de recolección solo permiten Carroñeros' })
    }
    if (units.scavenger === 0) {
      return res.status(400).json({ error: 'Necesitas al menos un Carroñero para recolectar' })
    }
  }

  // Colonize missions: colonists only
  if (missionType === 'colonize') {
    const nonColonists = UNIT_KEYS.filter(k => k !== 'colonist' && units[k] > 0)
    if (nonColonists.length > 0) {
      return res.status(400).json({ error: 'Las misiones de colonización solo permiten Colonistas' })
    }
    if (units.colonist === 0) {
      return res.status(400).json({ error: 'Necesitas al menos un Colonista para colonizar' })
    }
  }

  // Expedition missions: limited by floor(√cartography), minimum 1; holdingHours required
  let holdingHours = 0
  if (isExpedition) {
    const cartographyLevel = researchRow?.cartography ?? 0
    const maxExpeditions = Math.max(1, Math.floor(Math.sqrt(cartographyLevel)))
    const activeExpeditions = await db.select({ id: armyMissions.id, state: armyMissions.state }).from(armyMissions)
      .where(and(
        eq(armyMissions.userId, userId),
        eq(armyMissions.missionType, 'expedition'),
      ))
    // Count only active/returning/merchant (not completed)
    const ongoingCount = activeExpeditions.filter(m => m.state !== 'completed').length
    if (ongoingCount >= maxExpeditions) {
      return res.status(400).json({
        error: `Límite de expediciones alcanzado (${ongoingCount}/${maxExpeditions}). Mejora Cartografía para enviar más.`,
        maxExpeditions,
        cartographyLevel,
      })
    }

    // Validate holdingHours: 1 to cartographyLevel (min 1)
    holdingHours = parseInt(rawHoldingHours ?? 1, 10)
    const maxHolding = Math.max(1, cartographyLevel)
    if (isNaN(holdingHours) || holdingHours < 1 || holdingHours > maxHolding) {
      return res.status(400).json({
        error: `La duración de la expedición debe ser entre 1 y ${maxHolding} hora(s).`,
        maxHoldingHours: maxHolding,
      })
    }
  }

  // Deploy missions: target must be own kingdom (different slot)
  if (missionType === 'deploy') {
    const [target] = await db.select({ userId: kingdoms.userId }).from(kingdoms)
      .where(and(
        eq(kingdoms.realm,  tRealm),
        eq(kingdoms.region, tRegion),
        eq(kingdoms.slot,   tSlot),
      )).limit(1)
    if (!target) return res.status(400).json({ error: 'No existe un reino en ese slot' })
    if (target.userId !== userId) return res.status(400).json({ error: 'Solo puedes desplegar a tus propios reinos' })
  }

// ── Resources to carry (transport) ────────────────────────────────────────
  let woodLoad  = 0
  let stoneLoad = 0
  let grainLoad = 0

  if (missionType === 'transport' || missionType === 'deploy') {
    const safeFloat = v => { const n = parseFloat(v ?? 0); return isFinite(n) && n >= 0 ? n : 0 }
    woodLoad  = safeFloat(rawResources?.wood)
    stoneLoad = safeFloat(rawResources?.stone)
    grainLoad = safeFloat(rawResources?.grain)

    const capacity = calcCargoCapacity(units)
    if (woodLoad + stoneLoad + grainLoad > capacity) {
      return res.status(400).json({
        error: `La carga supera la capacidad de transporte (${capacity})`,
        capacity,
      })
    }
    if (woodLoad > kingdom.wood || stoneLoad > kingdom.stone || grainLoad > kingdom.grain) {
      return res.status(400).json({ error: 'No tienes suficientes recursos para transportar' })
    }
  }

  // ── Calculate travel time ─────────────────────────────────────────────────
  const origin   = { realm: kingdom.realm, region: kingdom.region, slot: kingdom.slot }
  const dest     = { realm: tRealm,        region: tRegion,        slot: tSlot        }
  const isWar = ['attack', 'spy'].includes(missionType)
  let universeSpeed = isWar
    ? parseFloat(cfg.fleet_speed_war ?? 1)
    : parseFloat(cfg.fleet_speed_peaceful ?? 1)
  // Deploy missions travel 10% faster than normal (OGame "holding" fleet speed bonus)
  if (missionType === 'deploy') universeSpeed *= 1.1

  // speedPct: player-chosen 10–100, default 100 (Feudum has no fuel cost)
  const speedPct = Math.min(100, Math.max(10, parseInt(rawSpeedPct ?? 100, 10) || 100))

  const distance   = calcDistance(origin, dest)
  const travelSecs = calcDuration(distance, units, speedPct, universeSpeed, researchRow ?? {}, userRow?.characterClass ?? null)

  if (travelSecs === 0) {
    return res.status(400).json({ error: 'No se pudo calcular el tiempo de viaje' })
  }

  const now         = Math.floor(Date.now() / 1000)
  const arrivalTime = now + travelSecs
  // Expedition: fleet stays at target for holdingHours before returning
  const holdingTimeSecs = isExpedition ? holdingHours * 3600 : 0
  const returnTime  = arrivalTime + holdingTimeSecs + travelSecs

  // ── Deduct units and resources atomically ────────────────────────────────
  const { wood, stone, grain } = applyResourceTick(kingdom, cfg, userRow?.characterClass ?? null, researchRow ?? null)

  const patch = {
    wood:  wood  - woodLoad,
    stone: stone - stoneLoad,
    grain: grain - grainLoad,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }
  for (const k of UNIT_KEYS) {
    if (units[k] > 0) patch[k] = (kingdom[k] ?? 0) - units[k]
  }

  // Optimistic lock: only update if kingdom hasn't been modified concurrently.
  // lastResourceUpdate acts as version — concurrent requests will see 0 rows updated.
  const unitWhereConditions = UNIT_KEYS
    .filter(k => units[k] > 0)
    .map(k => gte(kingdoms[k], units[k]))

  const updated = await db.update(kingdoms).set(patch)
    .where(and(
      eq(kingdoms.id, kingdom.id),
      eq(kingdoms.lastResourceUpdate, kingdom.lastResourceUpdate),
      ...unitWhereConditions,
    ))
    .returning({ id: kingdoms.id })

  if (updated.length === 0) {
    return res.status(409).json({ error: 'Conflicto de concurrencia, inténtalo de nuevo' })
  }

  // ── Create mission ────────────────────────────────────────────────────────
  const missionRow = {
    userId,
    missionType,
    state: 'active',
    startRealm:  kingdom.realm,
    startRegion: kingdom.region,
    startSlot:   kingdom.slot,
    targetRealm:  tRealm,
    targetRegion: tRegion,
    targetSlot:   tSlot,
    departureTime: now,
    arrivalTime,
    holdingTime: holdingTimeSecs,
    returnTime,
    woodLoad,
    stoneLoad,
    grainLoad,
    ...Object.fromEntries(UNIT_KEYS.map(k => [k, units[k]])),
  }

  const [inserted] = await db.insert(armyMissions).values(missionRow).returning({ id: armyMissions.id })

  return res.json({
    ok: true,
    missionId: inserted.id,
    arrivalTime,
    returnTime,
    travelSeconds: travelSecs,
    speedPct,
  })
}
