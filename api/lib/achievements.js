import { eq, and, inArray } from 'drizzle-orm'
import { db, kingdoms, research, messages, armyMissions, userAchievements } from '../_db.js'
import { ACHIEVEMENTS, ACH_BY_ID, checkConditions } from '../../src/lib/game/achievements.js'
import { getBuildingMap, getUnitMap } from './db-helpers.js'

export { ACHIEVEMENTS, ACH_BY_ID }

export async function checkAndUnlock(userId) {
  const [
    allKingdoms,
    allResearchRows,
    battleMsgs,
    spyMsgs,
    missionCounts,
    alreadyUnlocked,
  ] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)),
    db.select().from(research).where(eq(research.userId, userId)),
    db.select({ data: messages.data }).from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.type, 'battle'))),
    db.select({ id: messages.id }).from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.type, 'spy'))),
    db.select({ missionType: armyMissions.missionType })
      .from(armyMissions)
      .where(eq(armyMissions.userId, userId)),
    db.select({ achievementId: userAchievements.achievementId })
      .from(userAchievements).where(eq(userAchievements.userId, userId)),
  ])

  const res = Object.fromEntries(allResearchRows.map(r => [r.type, r.level]))

  const unlockedSet = new Set(alreadyUnlocked.map(a => a.achievementId))

  let k = {}
  if (allKingdoms.length > 0) {
    const primary = allKingdoms[0]
    const [bMap, uMap] = await Promise.all([
      getBuildingMap(primary.id),
      getUnitMap(primary.id),
    ])
    k = { ...primary, ...bMap, ...uMap }
  }

  // Battle stats
  let winCount = 0
  let loot10k  = false
  let bigLoot  = false
  for (const m of battleMsgs) {
    const d = m.data
    if (d?.outcome === 'victory') {
      winCount++
      const total = (d.loot?.wood ?? 0) + (d.loot?.stone ?? 0) + (d.loot?.grain ?? 0)
      if (total >= 10000) loot10k = true
      if (total >= 50000) bigLoot = true
    }
  }

  // Mission counts by type
  const missionsByType = {}
  for (const { missionType } of missionCounts) {
    missionsByType[missionType] = (missionsByType[missionType] ?? 0) + 1
  }

  const data = {
    k,
    res,
    winCount,
    loot10k,
    bigLoot,
    spyCount:        spyMsgs.length,
    colonyCount:     Math.max(0, allKingdoms.length - 1),
    attackCount:     missionsByType['attack']     ?? 0,
    transportCount:  missionsByType['transport']  ?? 0,
    expeditionCount: missionsByType['expedition'] ?? 0,
    scavengeCount:   missionsByType['scavenge']   ?? 0,
    missileCount:    missionsByType['missile']    ?? 0,
    deployCount:     missionsByType['deploy']     ?? 0,
  }

  const earned = checkConditions(data).filter(id => !unlockedSet.has(id))

  if (earned.length === 0) return []

  await db.insert(userAchievements).values(
    earned.map(achievementId => ({ userId, achievementId }))
  ).onConflictDoNothing()

  return earned.map(id => ACH_BY_ID[id]).filter(Boolean)
}
