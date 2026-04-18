import { db, users } from '../_db.js'
import { eq } from 'drizzle-orm'
import { getSessionUserId } from '../lib/handler.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users).where(eq(users.id, userId)).limit(1)

  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  return res.json(user)
}
