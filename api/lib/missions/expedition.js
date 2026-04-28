import { eq, and } from 'drizzle-orm'
import { db, armyMissions, messages, users, etherTransactions, kingdoms, debrisFields, pointsOfInterest, poiDiscoveries } from '../../_db.js'
import { resolveExpedition } from '../expedition.js'
import { calculateDebris } from '../battle.js'
import { extractMissionUnits, UNIT_KEYS } from './keys.js'
import { calcPoints } from '../points.js'
import { getResearchMap, getBuildingMaps, getUnitMaps } from '../db-helpers.js'
import { POI_TYPES, MAGNITUDE_DECAY } from '../poi.js'

const OUTCOME_LABELS = {
  nothing:   '🌑 Tierras Ignotas — expedición vacía',
  resources: '💰 Tierras Ignotas — botín abandonado',
  units:     '⚔️ Tierras Ignotas — supervivientes encontrados',
  delay:     '🌫️ Tierras Ignotas — caminos perdidos',
  speedup:   '💨 Tierras Ignotas — viento favorable',
  bandits:   '⚔️ Tierras Ignotas — Merodeadores — victoria',
  demons:    '⚔️ Tierras Ignotas — Bestias Oscuras — victoria',
  ether:     '✨ Tierras Ignotas — reliquias arcanas',
}

export async function processExpedition(mission, myKingdom, now) {
  const travelSecs   = mission.arrivalTime - mission.departureTime
  const holdingTime  = mission.holdingTime ?? 0
  const returnTime   = mission.arrivalTime + holdingTime + travelSecs
  const missionUnits = extractMissionUnits(mission, UNIT_KEYS)

  // Si el destino es slot 1-15 (no Tierras Ignotas), procesar como exploración
  // local: revisar POI, descubrir/decrementar/outcome según tipo. Slot 16 sigue
  // el flujo clásico de lottery (resolveExpedition más abajo).
  const isLocalExpedition = mission.targetSlot <= 15
  if (isLocalExpedition) {
    return await processLocalExpedition(mission, myKingdom, now, missionUnits, returnTime)
  }

  const [resMap, [userRow], allKingdoms] = await Promise.all([
    getResearchMap(myKingdom.userId),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, myKingdom.userId)).limit(1),
    db.select().from(kingdoms),
  ])

  // Top-1 player points for resource reward scaling — enrich with buildings + units
  const allKingdomIds = allKingdoms.map(k => k.id)
  const [expBMaps, expUMaps] = await Promise.all([getBuildingMaps(allKingdomIds), getUnitMaps(allKingdomIds)])
  const top1Points = allKingdoms.reduce((max, k) => {
    const p = calcPoints({ ...k, ...(expBMaps[k.id] ?? {}), ...(expUMaps[k.id] ?? {}) })
    return Math.max(max, p)
  }, 0)

  const isDiscoverer = userRow?.characterClass === 'discoverer'
  // Discoverer class: halve combat encounter probability, +50% resources/units
  const combatMultiplier = isDiscoverer ? 0.5 : 1.0

  const { outcome, result, unitPatch, returnTimeDelta, etherGained, destroyed, merchantOffer } =
    resolveExpedition(missionUnits, resMap, travelSecs, now, {
      top1Points, combatMultiplier, holdingTime, discoverer: isDiscoverer,
    })

  if (outcome === 'merchant' && merchantOffer) {
    await db.update(armyMissions).set({
      state: 'merchant',
      result: JSON.stringify({ type: 'expedition', outcome: 'merchant', merchantOffer }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
    return
  }

  // Expedition battle debris: 10% of all losses (not the standard 30%)
  if (result.lostAtk || result.lostDef) {
    const debris = calculateDebris(result.lostAtk ?? {}, result.lostDef ?? {}, 0.1)
    if (debris.wood > 0 || debris.stone > 0) {
      const [existing] = await db.select().from(debrisFields).where(and(
        eq(debrisFields.realm,  mission.targetRealm),
        eq(debrisFields.region, mission.targetRegion),
        eq(debrisFields.slot,   mission.targetSlot),
      )).limit(1)
      if (existing) {
        await db.update(debrisFields).set({
          wood: existing.wood + debris.wood, stone: existing.stone + debris.stone, updatedAt: new Date(),
        }).where(eq(debrisFields.id, existing.id))
      } else {
        await db.insert(debrisFields).values({
          realm: mission.targetRealm, region: mission.targetRegion, slot: mission.targetSlot,
          wood: debris.wood, stone: debris.stone,
        })
      }
    }
  }

  if (destroyed) {
    await db.update(armyMissions).set({
      state: 'completed',
      result: JSON.stringify({ type: 'expedition', outcome, ...result }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
    await db.insert(messages).values({
      userId: myKingdom.userId, type: 'expedition',
      subject: outcome === 'black_hole'
        ? '🌀 Tormenta Arcana — tu flota ha desaparecido'
        : `⚔️ Tierras Ignotas — ${outcome === 'bandits' ? 'Merodeadores' : 'Bestias Oscuras'} — derrota`,
      data: { type: 'expedition', outcome, ...result },
    })
    return
  }

  const finalUnits = { ...missionUnits }
  if (unitPatch) Object.assign(finalUnits, unitPatch)

  const woodLoad  = result.found?.wood  ?? 0
  const stoneLoad = result.found?.stone ?? 0
  const grainLoad = result.found?.grain ?? 0

  await db.update(armyMissions).set({
    units: finalUnits,
    state: 'returning',
    returnTime: Math.max(now + 1, returnTime + returnTimeDelta),
    woodLoad, stoneLoad, grainLoad,
    result: JSON.stringify({ type: 'expedition', outcome, ...result }),
    updatedAt: new Date(),
  }).where(eq(armyMissions.id, mission.id))

  if (etherGained > 0) {
    const [currentUser] = await db.select({ ether: users.ether })
      .from(users).where(eq(users.id, myKingdom.userId)).limit(1)
    await db.update(users)
      .set({ ether: (currentUser?.ether ?? 0) + etherGained })
      .where(eq(users.id, myKingdom.userId))
    await db.insert(etherTransactions).values({
      userId: myKingdom.userId, type: 'expedition', amount: etherGained,
      reason: 'Reliquias encontradas en las Tierras Ignotas',
    })
  }

  await db.insert(messages).values({
    userId: myKingdom.userId, type: 'expedition',
    subject: OUTCOME_LABELS[outcome] ?? '🌑 Tierras Ignotas — expedición completada',
    data: { type: 'expedition', outcome, ...result },
  })
}

// ── Expedición local (slot 1-15) — descubrir/explotar POI ────────────────────
//
// Cuatro casos:
//   A) POI existe y magnitud > 0  → descubrir (si nuevo) + outcome del tipo + decremento
//   B) POI existe pero magnitud 0 → ya agotado: outcome muy modesto
//   C) No existe POI              → outcome modesto (slot vacío sin nada)
//   D) Slot ocupado en el ínterin → mensaje de descarte (no debería pasar pero defensivo)
async function processLocalExpedition(mission, myKingdom, now, missionUnits, returnTime) {
  const coord = { realm: mission.targetRealm, region: mission.targetRegion, slot: mission.targetSlot }

  // Slot ocupado a posteriori: regreso sin botín
  const [occupant] = await db.select({ id: kingdoms.id }).from(kingdoms).where(and(
    eq(kingdoms.realm,  coord.realm),
    eq(kingdoms.region, coord.region),
    eq(kingdoms.slot,   coord.slot),
  )).limit(1)
  if (occupant) {
    return await closeLocalExpedition(mission, myKingdom, now, missionUnits, returnTime, {
      outcome: 'occupied',
      subject: '🏰 Slot ocupado — expedición sin botín',
      result: { type: 'expedition', outcome: 'occupied', message: 'El slot fue colonizado durante el viaje.' },
    })
  }

  const [poi] = await db.select().from(pointsOfInterest).where(and(
    eq(pointsOfInterest.realm,  coord.realm),
    eq(pointsOfInterest.region, coord.region),
    eq(pointsOfInterest.slot,   coord.slot),
  )).limit(1)

  // Caso C: slot vacío sin POI → outcome modesto, vuelve la flota
  if (!poi) {
    const roll = Math.random()
    let outcome, found
    if (roll < 0.60) {
      outcome = 'nothing_local'
      found   = { wood: 0, stone: 0, grain: 0 }
    } else {
      outcome = 'low_resources_local'
      // Recursos bajos: 200-1000 de algo random
      const res = ['wood', 'stone', 'grain'][Math.floor(Math.random() * 3)]
      found = { wood: 0, stone: 0, grain: 0 }
      found[res] = 200 + Math.floor(Math.random() * 800)
    }
    return await closeLocalExpedition(mission, myKingdom, now, missionUnits, returnTime, {
      outcome,
      subject: outcome === 'nothing_local'
        ? '🌑 Exploración local — nada de interés'
        : '🪙 Exploración local — recursos abandonados',
      result: { type: 'expedition', outcome, found },
      woodLoad:  found.wood,
      stoneLoad: found.stone,
      grainLoad: found.grain,
    })
  }

  // Caso B: POI agotado
  if (poi.magnitude <= 0) {
    return await closeLocalExpedition(mission, myKingdom, now, missionUnits, returnTime, {
      outcome: 'poi_depleted',
      subject: `🏚️ ${POI_TYPES[poi.type]?.label ?? 'Punto de interés'} — agotado`,
      result: {
        type: 'expedition', outcome: 'poi_depleted', poi: { type: poi.type, magnitude: 0 },
      },
    })
  }

  // Caso A: POI activo — registrar descubrimiento, generar outcome, decrementar magnitud
  // Idempotent: si ya descubrió este POI, ON CONFLICT DO NOTHING evita duplicados
  await db.insert(poiDiscoveries).values({
    poiRealm:  coord.realm,
    poiRegion: coord.region,
    poiSlot:   coord.slot,
    userId:    myKingdom.userId,
  }).onConflictDoNothing()

  // Descontar magnitud (clamped a 0 mínimo)
  const newMagnitude = Math.max(0, poi.magnitude - MAGNITUDE_DECAY)
  await db.update(pointsOfInterest).set({
    magnitude: newMagnitude,
  }).where(and(
    eq(pointsOfInterest.realm,  coord.realm),
    eq(pointsOfInterest.region, coord.region),
    eq(pointsOfInterest.slot,   coord.slot),
  ))

  // Outcome basado en tipo
  const def = POI_TYPES[poi.type] ?? null
  const exp = def?.expedition ?? {}
  const found  = { wood: 0, stone: 0, grain: 0 }
  let etherGained = 0
  let unitDrop = null
  let researchBonus = null

  if (exp.resource && exp.multiplier) {
    // Yacimientos: outcome ×2-3 del recurso
    const [min, max] = exp.multiplier
    const mult = min + Math.random() * (max - min)
    found[exp.resource] = Math.floor(2000 * mult)
  } else if (exp.ether) {
    const [min, max] = exp.ether
    etherGained = min + Math.floor(Math.random() * (max - min + 1))
  } else if (exp.unitDrop) {
    unitDrop = { type: exp.unitDrop, count: exp.count ?? 1 }
  } else if (exp.researchBonus) {
    researchBonus = exp.researchBonus
  }

  // Persistir éter
  if (etherGained > 0) {
    const [currentUser] = await db.select({ ether: users.ether })
      .from(users).where(eq(users.id, myKingdom.userId)).limit(1)
    await db.update(users)
      .set({ ether: (currentUser?.ether ?? 0) + etherGained })
      .where(eq(users.id, myKingdom.userId))
    await db.insert(etherTransactions).values({
      userId: myKingdom.userId, type: 'expedition', amount: etherGained,
      reason: `Reliquia arcana — R${coord.realm}:${coord.region}:${coord.slot}`,
    })
  }

  const outcome = newMagnitude === 0 ? 'poi_drained' : 'poi_explored'
  return await closeLocalExpedition(mission, myKingdom, now, missionUnits, returnTime, {
    outcome,
    subject: `${poiTypeIcon(poi.type)} ${def?.label ?? 'POI'} — ${newMagnitude === 0 ? 'agotado tras esta visita' : 'explotado'}`,
    result: {
      type: 'expedition', outcome,
      poi: { type: poi.type, magnitude: newMagnitude, magnitudeBefore: poi.magnitude },
      found, etherGained, unitDrop, researchBonus,
    },
    woodLoad:    found.wood,
    stoneLoad:   found.stone,
    grainLoad:   found.grain,
    unitPatch:   unitDrop ? { [unitDrop.type]: (missionUnits[unitDrop.type] ?? 0) + unitDrop.count } : null,
  })
}

function poiTypeIcon(type) {
  return {
    yacimiento_madera: '🌲',
    yacimiento_piedra: '⛰️',
    yacimiento_grano:  '🌾',
    reliquia_arcana:   '✨',
    ruinas_antiguas:   '🏛️',
    templo_perdido:    '🕍',
  }[type] ?? '🔍'
}

// Helper común: cerrar la expedición local con state=returning + mensaje
async function closeLocalExpedition(mission, myKingdom, now, missionUnits, returnTime, opts) {
  const finalUnits = opts.unitPatch ? { ...missionUnits, ...opts.unitPatch } : missionUnits
  await db.update(armyMissions).set({
    units: finalUnits,
    state: 'returning',
    returnTime: Math.max(now + 1, returnTime),
    woodLoad:  opts.woodLoad  ?? 0,
    stoneLoad: opts.stoneLoad ?? 0,
    grainLoad: opts.grainLoad ?? 0,
    result: JSON.stringify(opts.result),
    updatedAt: new Date(),
  }).where(eq(armyMissions.id, mission.id))

  await db.insert(messages).values({
    userId: myKingdom.userId, type: 'expedition',
    subject: opts.subject,
    data: opts.result,
  })
}
