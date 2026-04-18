import { eq } from 'drizzle-orm'
import { db, kingdoms, armyMissions } from '../../_db.js'

export async function processTransport(mission, myKingdom, now, targetKingdom) {
  const travelSecs = mission.arrivalTime - mission.departureTime
  const returnTime = now + travelSecs

  if (targetKingdom) {
    await db.update(kingdoms).set({
      wood:  Math.min(targetKingdom.wood  + mission.woodLoad,  targetKingdom.woodCapacity),
      stone: Math.min(targetKingdom.stone + mission.stoneLoad, targetKingdom.stoneCapacity),
      grain: Math.min(targetKingdom.grain + mission.grainLoad, targetKingdom.grainCapacity),
      updatedAt: new Date(),
    }).where(eq(kingdoms.id, targetKingdom.id))

    await db.update(armyMissions).set({
      state: 'returning', returnTime, woodLoad: 0, stoneLoad: 0, grainLoad: 0,
      result: JSON.stringify({ type: 'transport', delivered: true }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
  } else {
    await db.update(armyMissions).set({
      state: 'returning', returnTime,
      result: JSON.stringify({ type: 'transport', delivered: false, reason: 'No hay reino en el destino' }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
  }
}
