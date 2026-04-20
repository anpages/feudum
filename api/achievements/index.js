import { eq, and, isNull } from 'drizzle-orm'
import { db, kingdoms, userAchievements } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { ACHIEVEMENTS, ACH_BY_ID } from '../lib/achievements.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const rows = await db
    .select({ achievementId: userAchievements.achievementId, unlockedAt: userAchievements.unlockedAt, claimedAt: userAchievements.claimedAt })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId))

  const unlockedMap = new Map(rows.map(r => [r.achievementId, r]))

  const achievements = ACHIEVEMENTS.map(a => {
    const row = unlockedMap.get(a.id) ?? null
    return {
      ...a,
      unlocked:   !!row,
      unlockedAt: row?.unlockedAt ?? null,
      claimedAt:  row?.claimedAt  ?? null,
      pending:    !!row && !row.claimedAt && !!(a.reward?.wood || a.reward?.stone || a.reward?.grain),
    }
  })

  const pendingCount = achievements.filter(a => a.pending).length

  return res.status(200).json({ achievements, pendingCount })
}
