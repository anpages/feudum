import { eq } from 'drizzle-orm'
import { db, kingdoms, users, research } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { calcPoints } from '../lib/points.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const [allKingdoms, allResearch] = await Promise.all([
    db.select().from(kingdoms).innerJoin(users, eq(kingdoms.userId, users.id)),
    db.select().from(research),
  ])

  const researchByUser = Object.fromEntries(allResearch.map(r => [r.userId, r]))

  const ranked = allKingdoms
    .map(({ kingdoms: k, users: u }) => ({
      kingdomId: k.id,
      name:      k.name,
      username:  u.username,
      realm:     k.realm,
      region:    k.region,
      slot:      k.slot,
      points:    calcPoints(k, researchByUser[k.userId] ?? {}),
      isMe:      k.userId === userId,
    }))
    .sort((a, b) => b.points - a.points)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))

  return res.json({ rankings: ranked })
}
