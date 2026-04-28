import { eq, and, ne, asc } from 'drizzle-orm'
import { db, kingdoms, armyMissions, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { calcDistance, calcDuration, calcCargoCapacity, calcGrainConsumption } from '../lib/speed.js'
import { getSettings } from '../lib/settings.js'
import { applyResourceTick } from '../lib/tick.js'
import { processUserQueues } from '../lib/process-queues.js'
import { enrichKingdom, getResearchMap, getUnitMap, upsertUnit } from '../lib/db-helpers.js'
import { sendPush } from '../lib/push.js'
import { canColonize } from '../lib/colonize-rules.js'

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

  const { missionType, target, units: rawUnits, resources: rawResources, holdingHours: rawHoldingHours, speedPct: rawSpeedPct, kingdomId: reqKingdomId } = req.body ?? {}

  // ── Validate mission type ─────────────────────────────────────────────────
  if (!MISSION_TYPES.includes(missionType)) {
    return res.status(400).json({ error: 'Tipo de misión inválido' })
  }

  // ── Validate target ───────────────────────────────────────────────────────
  const tRealm  = parseInt(target?.realm,  10)
  const tRegion = parseInt(target?.region, 10)
  const tSlot   = parseInt(target?.slot,   10)

  const isExpedition = missionType === 'expedition'
  const isMissile    = missionType === 'missile'

  await processUserQueues(userId)

  // ── Load player kingdom (enriched with buildings + units) + research + class ──
  const kingdomQuery = reqKingdomId
    ? db.select().from(kingdoms).where(and(eq(kingdoms.id, reqKingdomId), eq(kingdoms.userId, userId))).limit(1)
    : db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).orderBy(asc(kingdoms.createdAt)).limit(1)

  const [[kingdomRow], resMap, [userRow], cfg] = await Promise.all([
    kingdomQuery,
    getResearchMap(userId),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdomRow) return res.status(404).json({ error: 'Reino no encontrado' })

  // ── Validate target coordinates against DB-configured universe dimensions ──
  const maxRealm  = Math.round(cfg.universe_realms  ?? 3)
  const maxRegion = Math.round(cfg.universe_regions ?? 10)
  const maxSlot   = isExpedition ? Math.round(cfg.universe_slots ?? 15) + 1 : Math.round(cfg.universe_slots ?? 15)

  if (!tRealm || !tRegion || !tSlot
    || tRealm  < 1 || tRealm  > maxRealm
    || tRegion < 1 || tRegion > maxRegion
    || tSlot   < 1 || tSlot   > maxSlot) {
    return res.status(400).json({ error: 'Coordenadas de destino inválidas' })
  }

  // Expedition slot = universe_slots + 1 (the "Uncharted Lands" beyond the map)
  const expeditionSlot = Math.round(cfg.universe_slots ?? 15) + 1
  if (isExpedition && tSlot !== expeditionSlot) {
    return res.status(400).json({ error: `Las expediciones deben dirigirse al slot ${expeditionSlot} (Tierras Ignotas)` })
  }

  const kingdom = await enrichKingdom(kingdomRow, { withUnits: true })

  // ── Fleet slot limit (Logistics research) — missiles don't use slots ──────
  if (!isMissile) {
    const logistics = resMap.logistics ?? 0
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
    const cartography = resMap.cartography ?? 0
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

    const { wood, stone, grain } = applyResourceTick(kingdom, cfg, userRow?.characterClass ?? null, resMap)

    // Deduct ballistic from units table
    await upsertUnit(kingdom.id, 'ballistic', Math.max(0, (kingdom.ballistic ?? 0) - ballisticCount))

    await db.update(kingdoms).set({
      wood, stone, grain,
      lastResourceUpdate: now,
      updatedAt: new Date(),
    }).where(eq(kingdoms.id, kingdom.id))

    const [inserted] = await db.insert(armyMissions).values({
      userId,
      originKingdomId: kingdom.id,
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
      units: { ballistic: ballisticCount },
    }).returning({ id: armyMissions.id })

    // Notify target player
    db.select({ userId: kingdoms.userId, role: users.role })
      .from(kingdoms)
      .innerJoin(users, eq(kingdoms.userId, users.id))
      .where(and(eq(kingdoms.realm, tRealm), eq(kingdoms.region, tRegion), eq(kingdoms.slot, tSlot)))
      .limit(1)
      .then(([tk]) => {
        if (tk && tk.role !== 'npc' && tk.userId !== userId) {
          sendPush(tk.userId, {
            title: '🪨 ¡Bombardeo entrante!',
            body: `${kingdom.name} lanza misiles hacia tu reino.`,
            url: '/armies',
            tag: 'incoming-attack',
          }).catch(() => {})
        }
      }).catch(() => {})

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

  // Colonize missions: exactly 1 colonist required
  if (missionType === 'colonize') {
    if (units.colonist !== 1) {
      return res.status(400).json({ error: 'Las misiones de colonización requieren exactamente 1 Colonista' })
    }
    // Colony limit: floor(cartography / 2) + 1 total kingdoms
    const cartography = resMap.cartography ?? 0
    const maxKingdoms = Math.floor(cartography / 2) + 1
    const ownedKingdoms = await db
      .select({ id: kingdoms.id, realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot })
      .from(kingdoms)
      .where(eq(kingdoms.userId, userId))
    if (ownedKingdoms.length >= maxKingdoms) {
      return res.status(400).json({
        error: `Has alcanzado el límite de colonias (${ownedKingdoms.length}/${maxKingdoms}). Mejora Cartografía para colonizar más.`,
        maxKingdoms,
        cartography,
      })
    }
    // Adyacencia territorial: la expansión es contigua, no por saltos.
    // Reglas detalladas en api/lib/colonize-rules.js.
    const adjacency = canColonize(ownedKingdoms, { realm: tRealm, region: tRegion, slot: tSlot })
    if (!adjacency.ok) {
      return res.status(400).json({ error: adjacency.reason })
    }
  }

  // Expedition missions: limited by floor(√cartography), minimum 1; holdingHours required
  let holdingHours = 0
  if (isExpedition) {
    const cartographyLevel = resMap.cartography ?? 0
    const discovererBonus = (userRow?.characterClass ?? null) === 'discoverer' ? 2 : 0
    const maxExpeditions = Math.max(1, Math.floor(Math.sqrt(cartographyLevel))) + discovererBonus
    const activeExpeditions = await db.select({ id: armyMissions.id, state: armyMissions.state }).from(armyMissions)
      .where(and(
        eq(armyMissions.userId, userId),
        eq(armyMissions.missionType, 'expedition'),
      ))
    // Count only active/returning/merchant (not completed)
    const ongoingCount = activeExpeditions.filter(m => m.state !== 'completed').length
    if (ongoingCount >= maxExpeditions) {
      return res.status(400).json({
        error: `Límite de expediciones alcanzado (${ongoingCount}/${maxExpeditions}). Mejora Cartografía o usa la clase Descubridor para enviar más.`,
        maxExpeditions,
        cartographyLevel,
      })
    }

    // Validate holdingHours: 1 to cartographyLevel (integer hours, like OGame)
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
    const [targetK] = await db.select({ userId: kingdoms.userId }).from(kingdoms)
      .where(and(
        eq(kingdoms.realm,  tRealm),
        eq(kingdoms.region, tRegion),
        eq(kingdoms.slot,   tSlot),
      )).limit(1)
    if (!targetK) return res.status(400).json({ error: 'No existe un reino en ese slot' })
    if (targetK.userId !== userId) return res.status(400).json({ error: 'Solo puedes desplegar a tus propios reinos' })
  }

  // ── Resources to carry (transport / deploy) ────────────────────────────────
  let woodLoad  = 0
  let stoneLoad = 0
  let grainLoad = 0

  if (missionType === 'transport' || missionType === 'deploy') {
    const safeFloat = v => { const n = parseFloat(v ?? 0); return isFinite(n) && n >= 0 ? n : 0 }
    woodLoad  = safeFloat(rawResources?.wood)
    stoneLoad = safeFloat(rawResources?.stone)
    grainLoad = safeFloat(rawResources?.grain)

    const capacity = calcCargoCapacity(units, userRow?.characterClass ?? null)
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
  // Deploy missions travel 10% faster than normal
  if (missionType === 'deploy') universeSpeed *= 1.1

  // speedPct: player-chosen 10–100, default 100
  const speedPct = Math.min(100, Math.max(10, parseInt(rawSpeedPct ?? 100, 10) || 100))

  const distance   = calcDistance(origin, dest)
  const travelSecs = calcDuration(distance, units, speedPct, universeSpeed, resMap, userRow?.characterClass ?? null)

  if (travelSecs === 0) {
    return res.status(400).json({ error: 'No se pudo calcular el tiempo de viaje' })
  }

  // ── Grain consumption (OGame fuel formula) ───────────────────────────────
  const grainConsumption = calcGrainConsumption(
    units, distance, travelSecs, universeSpeed, resMap,
    userRow?.characterClass ?? null,
    isExpedition ? holdingHours : 0,
  )

  const now         = Math.floor(Date.now() / 1000)
  const arrivalTime = now + travelSecs
  const holdingTimeSecs = isExpedition ? holdingHours * 3600 : 0
  const returnTime  = arrivalTime + holdingTimeSecs + travelSecs

  // ── Deduct units and resources atomically ────────────────────────────────
  const { wood, stone, grain } = applyResourceTick(kingdom, cfg, userRow?.characterClass ?? null, resMap)

  // Validate: player needs enough grain for cargo + fuel
  const totalGrainNeeded = grainLoad + grainConsumption
  if (grain < totalGrainNeeded) {
    return res.status(400).json({
      error: `Grano insuficiente para el combustible de la misión (necesitas ${totalGrainNeeded}, tienes ${Math.floor(grain)})`,
      grainNeeded: totalGrainNeeded,
      grainAvailable: Math.floor(grain),
    })
  }

  // Update kingdom resources (optimistic lock via lastResourceUpdate)
  const updated = await db.update(kingdoms).set({
    wood:  wood  - woodLoad,
    stone: stone - stoneLoad,
    grain: grain - grainLoad - grainConsumption,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }).where(and(
    eq(kingdoms.id, kingdom.id),
    eq(kingdoms.lastResourceUpdate, kingdom.lastResourceUpdate),
  )).returning({ id: kingdoms.id })

  if (updated.length === 0) {
    return res.status(409).json({ error: 'Conflicto de concurrencia, inténtalo de nuevo' })
  }

  // Deduct units from units table
  const currentUnitMap = await getUnitMap(kingdom.id)
  for (const k of UNIT_KEYS) {
    if (units[k] > 0) {
      await upsertUnit(kingdom.id, k, Math.max(0, (currentUnitMap[k] ?? 0) - units[k]))
    }
  }

  // ── Create mission ────────────────────────────────────────────────────────
  // Build filtered units object (only non-zero values)
  const filteredUnits = {}
  for (const k of UNIT_KEYS) {
    if (units[k] > 0) filteredUnits[k] = units[k]
  }

  const [inserted] = await db.insert(armyMissions).values({
    userId,
    originKingdomId: kingdom.id,
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
    units: filteredUnits,
  }).returning({ id: armyMissions.id })

  // Notify target player of incoming hostile mission
  if (['attack', 'spy'].includes(missionType)) {
    db.select({ userId: kingdoms.userId, role: users.role })
      .from(kingdoms)
      .innerJoin(users, eq(kingdoms.userId, users.id))
      .where(and(eq(kingdoms.realm, tRealm), eq(kingdoms.region, tRegion), eq(kingdoms.slot, tSlot)))
      .limit(1)
      .then(([tk]) => {
        if (tk && tk.role !== 'npc' && tk.userId !== userId) {
          const eta = Math.round(travelSecs / 60)
          sendPush(tk.userId, {
            title: missionType === 'attack' ? '⚔️ ¡Ataque entrante!' : '🕵️ ¡Espía detectado!',
            body: `${kingdom.name} ${missionType === 'attack' ? 'te ataca' : 'espía tu reino'}. Llega en ~${eta} min.`,
            url: '/armies',
            tag: 'incoming-attack',
          }).catch(() => {})
        }
      }).catch(() => {})
  }

  return res.json({
    ok: true,
    missionId: inserted.id,
    arrivalTime,
    returnTime,
    travelSeconds: travelSecs,
    grainConsumption,
    speedPct,
  })
}
