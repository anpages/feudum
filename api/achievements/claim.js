import { eq, and, isNull } from 'drizzle-orm'
import { db, kingdoms, userAchievements } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { ACH_BY_ID } from '../lib/achievements.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { achievementId } = req.body ?? {}
  if (!achievementId) return res.status(400).json({ error: 'achievementId requerido' })

  const ach = ACH_BY_ID[achievementId]
  if (!ach) return res.status(404).json({ error: 'Logro no encontrado' })

  // Find the unlocked-but-unclaimed row
  const [row] = await db
    .select()
    .from(userAchievements)
    .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)))
    .limit(1)

  if (!row) return res.status(404).json({ error: 'Logro no desbloqueado' })
  if (row.claimedAt) return res.status(409).json({ error: 'Ya reclamado' })

  // Mark as claimed
  await db
    .update(userAchievements)
    .set({ claimedAt: new Date() })
    .where(and(eq(userAchievements.userId, userId), eq(userAchievements.achievementId, achievementId)))

  // Deliver reward to primary kingdom
  const reward = ach.reward
  if (reward && (reward.wood > 0 || reward.stone > 0 || reward.grain > 0)) {
    const [k] = await db
      .select()
      .from(kingdoms)
      .where(and(eq(kingdoms.userId, userId), eq(kingdoms.isNpc, false)))
      .orderBy(kingdoms.createdAt)
      .limit(1)

    if (k) {
      await db.update(kingdoms).set({
        wood:  Math.min((k.wood  ?? 0) + (reward.wood  ?? 0), k.woodCapacity  ?? 10000),
        stone: Math.min((k.stone ?? 0) + (reward.stone ?? 0), k.stoneCapacity ?? 10000),
        grain: Math.min((k.grain ?? 0) + (reward.grain ?? 0), k.grainCapacity ?? 10000),
        updatedAt: new Date(),
      }).where(eq(kingdoms.id, k.id))
    }
  }

  return res.status(200).json({ ok: true, reward: reward ?? null })
}
