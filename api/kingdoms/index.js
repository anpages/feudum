import { eq } from 'drizzle-orm'
import { db, kingdoms } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const rows = await db
    .select({
      id:     kingdoms.id,
      name:   kingdoms.name,
      realm:  kingdoms.realm,
      region: kingdoms.region,
      slot:   kingdoms.slot,
    })
    .from(kingdoms)
    .where(eq(kingdoms.userId, userId))

  return res.json({ kingdoms: rows })
}
