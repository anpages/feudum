/**
 * GET /api/season/history — player's past season snapshots (for profile page).
 */
import { eq, desc } from 'drizzle-orm'
import { db, seasonSnapshots } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const snapshots = await db.select()
    .from(seasonSnapshots)
    .where(eq(seasonSnapshots.userId, userId))
    .orderBy(desc(seasonSnapshots.seasonNumber))

  return res.json({ snapshots })
}
