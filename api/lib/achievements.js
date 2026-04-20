/**
 * Achievement DB-backed unlocker. Catalog + pure conditions live in
 * src/lib/game/achievements.js so the client can render the full list and
 * compare against unlocked ones.
 */
import { eq, and } from 'drizzle-orm'
import { db, kingdoms, research, messages, userAchievements } from '../_db.js'
import { ACHIEVEMENTS, ACH_BY_ID, checkConditions } from '../../src/lib/game/achievements.js'

export { ACHIEVEMENTS, ACH_BY_ID }

export async function checkAndUnlock(userId) {
  const [allKingdoms, [resRow], battleMsgs, spyMsgs, seasonMsgs, alreadyUnlocked] = await Promise.all([
    db.select().from(kingdoms).where(and(eq(kingdoms.userId, userId), eq(kingdoms.isNpc, false))),
    db.select().from(research).where(eq(research.userId, userId)).limit(1),
    db.select({ data: messages.data }).from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.type, 'battle'))),
    db.select({ id: messages.id }).from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.type, 'spy'))),
    db.select({ id: messages.id, data: messages.data }).from(messages)
      .where(and(eq(messages.userId, userId), eq(messages.type, 'season'))),
    db.select({ achievementId: userAchievements.achievementId })
      .from(userAchievements).where(eq(userAchievements.userId, userId)),
  ])

  const unlockedSet = new Set(alreadyUnlocked.map(a => a.achievementId))
  const k = allKingdoms[0] ?? {}

  let winCount = 0
  let bigLoot = false
  for (const m of battleMsgs) {
    try {
      const d = JSON.parse(m.data)
      if (d.outcome === 'victory') {
        winCount++
        const loot = (d.loot?.wood ?? 0) + (d.loot?.stone ?? 0) + (d.loot?.grain ?? 0)
        if (loot >= 50000) bigLoot = true
      }
    } catch { /* ignore malformed */ }
  }

  const bossKilled = seasonMsgs.some(m => {
    try { return !!JSON.parse(m.data ?? '{}').seasonVictory } catch { return false }
  })

  const data = {
    k,
    res: resRow ?? null,
    winCount,
    spyCount: spyMsgs.length,
    colonyCount: Math.max(0, allKingdoms.length - 1),
    bigLoot,
    bossKilled,
  }

  const earned = checkConditions(data).filter(id => !unlockedSet.has(id))

  if (earned.length === 0) return []

  await db.insert(userAchievements).values(
    earned.map(achievementId => ({ userId, achievementId }))
  ).onConflictDoNothing()

  // Apply cumulative resource reward to the primary kingdom
  const earnedAchs = earned.map(id => ACH_BY_ID[id]).filter(Boolean)
  if (k.id && earnedAchs.some(a => a.reward)) {
    let totalWood = 0, totalStone = 0, totalGrain = 0
    for (const a of earnedAchs) {
      totalWood  += a.reward?.wood  ?? 0
      totalStone += a.reward?.stone ?? 0
      totalGrain += a.reward?.grain ?? 0
    }
    if (totalWood > 0 || totalStone > 0 || totalGrain > 0) {
      await db.update(kingdoms).set({
        wood:  Math.min((k.wood  ?? 0) + totalWood,  k.woodCapacity  ?? 10000),
        stone: Math.min((k.stone ?? 0) + totalStone, k.stoneCapacity ?? 10000),
        grain: Math.min((k.grain ?? 0) + totalGrain, k.grainCapacity ?? 10000),
        updatedAt: new Date(),
      }).where(eq(kingdoms.id, k.id))
    }
  }

  return earnedAchs
}
