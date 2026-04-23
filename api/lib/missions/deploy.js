import { eq } from 'drizzle-orm'
import { db, kingdoms, armyMissions, messages } from '../../_db.js'
import { getUnitMap, upsertUnit } from '../db-helpers.js'

export async function processDeploy(mission, myKingdom, now, targetKingdom) {
  const travelSecs = mission.arrivalTime - mission.departureTime
  const returnTime = now + travelSecs

  if (targetKingdom && targetKingdom.userId === myKingdom.userId) {
    // Add units to target kingdom
    const missionUnits = mission.units ?? {}
    const currentUnitMap = await getUnitMap(targetKingdom.id)
    for (const [type, count] of Object.entries(missionUnits)) {
      if (count > 0) await upsertUnit(targetKingdom.id, type, (currentUnitMap[type] ?? 0) + count)
    }

    // Add resources to target kingdom
    const resourcePatch = {}
    if ((mission.woodLoad  ?? 0) > 0) resourcePatch.wood  = Math.min((targetKingdom.wood  ?? 0) + mission.woodLoad,  targetKingdom.woodCapacity)
    if ((mission.stoneLoad ?? 0) > 0) resourcePatch.stone = Math.min((targetKingdom.stone ?? 0) + mission.stoneLoad, targetKingdom.stoneCapacity)
    if ((mission.grainLoad ?? 0) > 0) resourcePatch.grain = Math.min((targetKingdom.grain ?? 0) + mission.grainLoad, targetKingdom.grainCapacity)
    if (Object.keys(resourcePatch).length > 0) {
      await db.update(kingdoms).set({ ...resourcePatch, updatedAt: new Date() })
        .where(eq(kingdoms.id, targetKingdom.id))
    }

    await db.update(armyMissions).set({
      state: 'completed',
      result: JSON.stringify({ type: 'deploy', success: true }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))

    await db.insert(messages).values({
      userId: myKingdom.userId, type: 'system',
      subject: `🚩 Despliegue llegó a ${targetKingdom.name}`,
      data: { type: 'deploy', success: true, target: targetKingdom.name },
    })
  } else {
    await db.update(armyMissions).set({
      state: 'returning', returnTime,
      result: JSON.stringify({ type: 'deploy', success: false, reason: 'Reino ya no es tuyo' }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
  }
}
