import { eq, and, inArray } from 'drizzle-orm'
import { db, kingdoms, research, messages, armyMissions, userAchievements } from '../_db.js'
import { ACHIEVEMENTS, ACH_BY_ID, checkConditions } from '../../src/lib/game/achievements.js'

export { ACHIEVEMENTS, ACH_BY_ID }

export async function checkAndUnlock(userId) {
  const [
    allKingdoms,
    [resRow],
    battleMsgs,
    spyMsgs,
    seasonMsgs,
    missionCounts,
    alreadyUnlocked,
  ] = await Promise.all([
    db.select().from(kingdoms).where(and(eq(kingdoms.userId, userId), eq(kingdoms.isNpc, false))),
    db.select().from(research).where(eq(research.userId, userId)).limit(1),
    db.select({ data: messages.data }).from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.type, 'battle'))),
    db.select({ id: messages.id }).from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.type, 'spy'))),
    db.select({ data: messages.data }).from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.type, 'season'))),
    db.select({ missionType: armyMissions.missionType })
      .from(armyMissions)
      .where(eq(armyMissions.userId, userId)),
    db.select({ achievementId: userAchievements.achievementId })
      .from(userAchievements).where(eq(userAchievements.userId, userId)),
  ])

  const unlockedSet = new Set(alreadyUnlocked.map(a => a.achievementId))
  const k = allKingdoms[0] ?? {}

  // Battle stats
  let winCount = 0
  let loot10k  = false
  let bigLoot  = false
  for (const m of battleMsgs) {
    try {
      const d = JSON.parse(m.data)
      if (d.outcome === 'victory') {
        winCount++
        const total = (d.loot?.wood ?? 0) + (d.loot?.stone ?? 0) + (d.loot?.grain ?? 0)
        if (total >= 10000) loot10k = true
        if (total >= 50000) bigLoot = true
      }
    } catch { /* ignore malformed */ }
  }

  // Season stats
  const bossKilled   = seasonMsgs.some(m => { try { return !!JSON.parse(m.data ?? '{}').seasonVictory } catch { return false } })
  const bossSpy      = seasonMsgs.some(m => { try { return !!JSON.parse(m.data ?? '{}').bossSpied     } catch { return false } })
  const bossAttacked = seasonMsgs.some(m => { try { return !!JSON.parse(m.data ?? '{}').bossAttacked  } catch { return false } })

  // Mission counts by type
  const missionsByType = {}
  for (const { missionType } of missionCounts) {
    missionsByType[missionType] = (missionsByType[missionType] ?? 0) + 1
  }

  const data = {
    k,
    res:             resRow ?? null,
    winCount,
    loot10k,
    bigLoot,
    spyCount:        spyMsgs.length,
    colonyCount:     Math.max(0, allKingdoms.length - 1),
    bossKilled,
    bossSpy,
    bossAttacked,
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
