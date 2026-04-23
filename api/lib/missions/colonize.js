import { eq } from 'drizzle-orm'
import { db, kingdoms, armyMissions } from '../../_db.js'

export async function processColonize(mission, myKingdom, now, targetKingdom) {
  const travelSecs = mission.arrivalTime - mission.departureTime
  const returnTime = now + travelSecs

  // Build a new units object without the colonist (consumed on arrival)
  const missionUnits = mission.units ?? {}
  const returningUnits = { ...missionUnits, colonist: 0 }

  if (!targetKingdom) {
    const kingdomName = `Colonia ${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot}`
    await db.insert(kingdoms).values({
      userId: myKingdom.userId,
      name:   kingdomName,
      realm:  mission.targetRealm,
      region: mission.targetRegion,
      slot:   mission.targetSlot,
      wood: 500, stone: 500, grain: 500,
      woodCapacity: 10000, stoneCapacity: 10000, grainCapacity: 10000,
      lastResourceUpdate: now,
    })
    await db.update(armyMissions).set({
      units: returningUnits,
      state: 'returning', returnTime,
      result: JSON.stringify({ type: 'colonize', success: true, name: kingdomName }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
  } else {
    // Slot occupied — colonist is still consumed, other units return
    await db.update(armyMissions).set({
      units: returningUnits,
      state: 'returning', returnTime,
      result: JSON.stringify({ type: 'colonize', success: false, reason: 'Posición ya ocupada' }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
  }
}
