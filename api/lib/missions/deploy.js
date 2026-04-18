import { eq } from 'drizzle-orm'
import { db, kingdoms, armyMissions, messages } from '../../_db.js'
import { UNIT_KEYS } from './keys.js'

export async function processDeploy(mission, myKingdom, now, targetKingdom) {
  const travelSecs = mission.arrivalTime - mission.departureTime
  const returnTime = now + travelSecs

  if (targetKingdom && targetKingdom.userId === myKingdom.userId) {
    const patch = { updatedAt: new Date() }
    for (const k of UNIT_KEYS) {
      if ((mission[k] ?? 0) > 0) patch[k] = (targetKingdom[k] ?? 0) + mission[k]
    }
    patch.wood  = (targetKingdom.wood  ?? 0) + (mission.woodLoad  ?? 0)
    patch.stone = (targetKingdom.stone ?? 0) + (mission.stoneLoad ?? 0)
    patch.grain = (targetKingdom.grain ?? 0) + (mission.grainLoad ?? 0)
    await db.update(kingdoms).set(patch).where(eq(kingdoms.id, targetKingdom.id))

    await db.update(armyMissions).set({
      state: 'completed',
      result: JSON.stringify({ type: 'deploy', success: true }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))

    await db.insert(messages).values({
      userId: myKingdom.userId, type: 'system',
      subject: `🚩 Despliegue llegó a ${targetKingdom.name}`,
      data: JSON.stringify({ type: 'deploy', success: true, target: targetKingdom.name }),
    })
  } else {
    await db.update(armyMissions).set({
      state: 'returning', returnTime,
      result: JSON.stringify({ type: 'deploy', success: false, reason: 'Reino ya no es tuyo' }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
  }
}
