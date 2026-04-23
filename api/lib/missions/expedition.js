import { eq, and } from 'drizzle-orm'
import { db, armyMissions, research, messages, users, etherTransactions, kingdoms, debrisFields } from '../../_db.js'
import { resolveExpedition } from '../expedition.js'
import { calculateDebris } from '../battle.js'
import { extractMissionUnits, UNIT_KEYS } from './keys.js'
import { calcPoints } from '../points.js'
import { getResearchMap } from '../db-helpers.js'

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

  const [resMap, [userRow], allKingdoms] = await Promise.all([
    getResearchMap(myKingdom.userId),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, myKingdom.userId)).limit(1),
    db.select().from(kingdoms),
  ])

  // Top-1 player points for resource reward scaling
  const top1Points = allKingdoms.reduce((max, k) => Math.max(max, calcPoints(k)), 0)

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
