/**
 * GET /api/achievements — returns all achievements with unlock status.
 * Also runs checkAndUnlock to auto-unlock newly earned ones.
 */
import { eq } from 'drizzle-orm'
import { db, userAchievements } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { ACHIEVEMENTS, checkAndUnlock } from '../lib/achievements.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  // Check + unlock new achievements
  const newlyUnlocked = await checkAndUnlock(userId)

  // Fetch all current unlocked set
  const unlocked = await db.select().from(userAchievements)
    .where(eq(userAchievements.userId, userId))

  const unlockedMap = Object.fromEntries(
    unlocked.map(u => [u.achievementId, u.unlockedAt])
  )

  const result = ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked:   !!unlockedMap[a.id],
    unlockedAt: unlockedMap[a.id] ?? null,
    isNew:      newlyUnlocked.some(n => n.id === a.id),
  }))

  return res.json({ achievements: result, newlyUnlocked: newlyUnlocked.map(a => a.id) })
}
