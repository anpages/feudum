import { eq } from 'drizzle-orm'
import { db, armyMissions, research, messages, users, etherTransactions } from '../../_db.js'
import { resolveExpedition } from '../expedition.js'
import { UNIT_KEYS } from './keys.js'

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
  const returnTime   = now + travelSecs
  const missionUnits = {}
  for (const k of UNIT_KEYS) missionUnits[k] = mission[k] ?? 0

  const [researchRow] = await db.select().from(research)
    .where(eq(research.userId, myKingdom.userId)).limit(1)

  const { outcome, result, unitPatch, returnTimeDelta, etherGained, destroyed, merchantOffer } =
    resolveExpedition(missionUnits, researchRow ?? {}, travelSecs, now)

  if (outcome === 'merchant' && merchantOffer) {
    await db.update(armyMissions).set({
      state: 'merchant',
      result: JSON.stringify({ type: 'expedition', outcome: 'merchant', merchantOffer }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
    return
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
      data: JSON.stringify({ type: 'expedition', outcome, ...result }),
    })
    return
  }

  const finalUnits = { ...missionUnits }
  if (unitPatch) Object.assign(finalUnits, unitPatch)

  const woodLoad  = result.found?.wood  ?? 0
  const stoneLoad = result.found?.stone ?? 0
  const grainLoad = result.found?.grain ?? 0

  await db.update(armyMissions).set({
    ...finalUnits, state: 'returning',
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
    data: JSON.stringify({ type: 'expedition', outcome, ...result }),
  })
}
