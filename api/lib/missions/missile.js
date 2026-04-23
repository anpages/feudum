import { eq } from 'drizzle-orm'
import { db, kingdoms, armyMissions, messages } from '../../_db.js'
import { UNIT_STATS } from '../battle.js'
import { DEFENSE_KEYS } from './keys.js'
import { getResearchMap, enrichKingdom, batchUpsertUnits } from '../db-helpers.js'

export async function processMissile(mission, myKingdom, now, targetKingdom) {
  const missionUnits = mission.units ?? {}
  const sentMissiles = missionUnits.ballistic ?? 0

  const complete = (result) =>
    db.update(armyMissions).set({
      state: 'completed', result: JSON.stringify(result), updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))

  if (!targetKingdom) {
    await complete({ type: 'missile', intercepted: 0, remaining: sentMissiles, damageDealt: {}, targetName: null })
    return
  }

  const [atkResMap, defResMap, enrichedTarget] = await Promise.all([
    getResearchMap(myKingdom.userId),
    getResearchMap(targetKingdom.userId),
    enrichKingdom(targetKingdom, { withUnits: true }),
  ])

  const swordsmanship = atkResMap.swordsmanship ?? 0
  const armouryRes    = defResMap.armoury       ?? 0

  const trebs       = enrichedTarget.trebuchet ?? 0
  const intercepted = Math.min(trebs, sentMissiles)
  const remaining   = sentMissiles - intercepted
  const damageDealt = {}

  if (remaining > 0) {
    let damagePool = remaining * 12000 * (1 + 0.1 * swordsmanship)

    const defenseOrder = DEFENSE_KEYS.filter(k => k !== 'trebuchet').sort((a, b) => {
      const aArmor = ((UNIT_STATS[a]?.hull ?? 0) * (1 + 0.1 * armouryRes)) / 10
      const bArmor = ((UNIT_STATS[b]?.hull ?? 0) * (1 + 0.1 * armouryRes)) / 10
      return aArmor - bArmor
    })

    const defUnitPatch = {}
    for (const k of defenseOrder) {
      if (damagePool <= 0) break
      const count = enrichedTarget[k] ?? 0
      if (count === 0) continue
      const armor = ((UNIT_STATS[k]?.hull ?? 0) * (1 + 0.1 * armouryRes)) / 10
      if (armor <= 0) continue
      const destroyed = Math.min(count, Math.floor(damagePool / armor))
      if (destroyed > 0) {
        damageDealt[k]  = destroyed
        defUnitPatch[k] = count - destroyed
        damagePool     -= destroyed * armor
      }
    }

    if (Object.keys(defUnitPatch).length > 0) {
      await batchUpsertUnits(targetKingdom.id, defUnitPatch)
    }
  }

  const result = { type: 'missile', targetName: targetKingdom.name, sentMissiles, intercepted, remaining, damageDealt }
  await complete(result)

  await db.insert(messages).values({
    userId: myKingdom.userId, type: 'battle',
    subject: `🚀 Bombardeo sobre ${targetKingdom.name}`,
    data: result,
  })

  if (!targetKingdom.isNpc) {
    await db.insert(messages).values({
      userId: targetKingdom.userId, type: 'battle',
      subject: '💥 Tu reino fue bombardeado',
      data: result,
    })
  }
}
