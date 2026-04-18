import { eq } from 'drizzle-orm'
import { db, kingdoms } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const [kingdom] = await db.select().from(kingdoms)
    .where(eq(kingdoms.userId, userId)).limit(1)
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  const now     = Math.floor(Date.now() / 1000)
  const elapsed = Math.max(0, now - kingdom.lastResourceUpdate) / 3600

  if (elapsed > 0) {
    const wood  = Math.min(kingdom.wood  + kingdom.woodProduction  * elapsed, kingdom.woodCapacity)
    const stone = Math.min(kingdom.stone + kingdom.stoneProduction * elapsed, kingdom.stoneCapacity)
    const grain = Math.min(kingdom.grain + kingdom.grainProduction * elapsed, kingdom.grainCapacity)

    const [updated] = await db.update(kingdoms)
      .set({ wood, stone, grain, lastResourceUpdate: now, updatedAt: new Date() })
      .where(eq(kingdoms.id, kingdom.id))
      .returning()

    return res.json(updated)
  }

  return res.json(kingdom)
}
