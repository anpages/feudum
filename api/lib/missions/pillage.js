import { eq } from 'drizzle-orm'
import { db, kingdoms, armyMissions, messages } from '../../_db.js'
import { calcCargoCapacity, calculateLoot } from '../battle.js'
import { UNIT_KEYS } from './keys.js'

export async function processPillage(mission, myKingdom, now, targetKingdom) {
  const travelSecs  = mission.arrivalTime - mission.departureTime
  const returnTime  = now + travelSecs
  const missionUnits = {}
  for (const k of UNIT_KEYS) missionUnits[k] = mission[k] ?? 0

  let npcRes, npcStrength
  if (targetKingdom?.isNpc) {
    npcRes      = { wood: targetKingdom.wood, stone: targetKingdom.stone, grain: targetKingdom.grain }
    npcStrength = (targetKingdom.npcLevel ?? 1) * 15000
  } else {
    const seed  = mission.targetRealm * 374761397 + mission.targetRegion * 1234567 + mission.targetSlot * 7654321
    npcStrength = ((seed ^ (seed >>> 16)) >>> 0) % 50000
    npcRes      = {
      wood:  Math.floor(1000 + npcStrength * 0.5),
      stone: Math.floor(800  + npcStrength * 0.4),
      grain: Math.floor(600  + npcStrength * 0.1),
    }
  }

  const cargo  = calcCargoCapacity(missionUnits)
  const loot   = calculateLoot(npcRes, cargo)
  const casualtyRate = Math.min(0.15, npcStrength / 300000)

  const survivorPatch = {}
  for (const k of UNIT_KEYS) {
    const n = missionUnits[k] ?? 0
    if (n === 0) { survivorPatch[k] = 0; continue }
    let survivors = 0
    for (let i = 0; i < n; i++) {
      if (Math.random() >= casualtyRate) survivors++
    }
    survivorPatch[k] = survivors
  }

  if (targetKingdom?.isNpc && (loot.wood > 0 || loot.stone > 0 || loot.grain > 0)) {
    await db.update(kingdoms).set({
      wood:  Math.max(0, targetKingdom.wood  - loot.wood),
      stone: Math.max(0, targetKingdom.stone - loot.stone),
      grain: Math.max(0, targetKingdom.grain - loot.grain),
      updatedAt: new Date(),
    }).where(eq(kingdoms.id, targetKingdom.id))
  }

  const result = { type: 'pillage', loot, survivorPatch }

  await db.update(armyMissions).set({
    ...survivorPatch, state: 'returning', returnTime,
    woodLoad: loot.wood, stoneLoad: loot.stone, grainLoad: loot.grain,
    result: JSON.stringify(result),
    updatedAt: new Date(),
  }).where(eq(armyMissions.id, mission.id))

  await db.insert(messages).values({
    userId: myKingdom.userId, type: 'battle',
    subject: `⚔️ Pillaje en R${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot}`,
    data: JSON.stringify(result),
  })
}
