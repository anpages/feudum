import { eq, and } from 'drizzle-orm'
import { db, armyMissions, debrisFields } from '../../_db.js'
import { calcCargoCapacity } from '../battle.js'
import { UNIT_KEYS } from './keys.js'

export async function processScavenge(mission, myKingdom, now, targetKingdom) {
  const travelSecs  = mission.arrivalTime - mission.departureTime
  const returnTime  = now + travelSecs
  const missionUnits = {}
  for (const k of UNIT_KEYS) missionUnits[k] = mission[k] ?? 0
  const cargo = calcCargoCapacity(missionUnits)

  const [debris] = await db.select().from(debrisFields).where(and(
    eq(debrisFields.realm,  mission.targetRealm),
    eq(debrisFields.region, mission.targetRegion),
    eq(debrisFields.slot,   mission.targetSlot),
  )).limit(1)

  let collected = { wood: 0, stone: 0 }
  if (debris && cargo > 0) {
    const total = debris.wood + debris.stone
    const ratio = Math.min(1, cargo / total)
    collected.wood  = Math.floor(debris.wood  * ratio)
    collected.stone = Math.floor(debris.stone * ratio)
    const remaining = { wood: debris.wood - collected.wood, stone: debris.stone - collected.stone }
    if (remaining.wood < 1 && remaining.stone < 1) {
      await db.delete(debrisFields).where(eq(debrisFields.id, debris.id))
    } else {
      await db.update(debrisFields).set({ ...remaining, updatedAt: new Date() })
        .where(eq(debrisFields.id, debris.id))
    }
  }

  await db.update(armyMissions).set({
    state: 'returning', returnTime,
    woodLoad: collected.wood, stoneLoad: collected.stone,
    result: JSON.stringify({ type: 'scavenge', collected }),
    updatedAt: new Date(),
  }).where(eq(armyMissions.id, mission.id))
}
