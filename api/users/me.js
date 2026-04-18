import { eq } from 'drizzle-orm'
import { db, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

export default async function handler(req, res) {
  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  if (req.method === 'GET') {
    const [user] = await db
      .select({ id: users.id, username: users.username, email: users.email, avatarUrl: users.avatarUrl, createdAt: users.createdAt })
      .from(users).where(eq(users.id, userId)).limit(1)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    return res.json(user)
  }

  if (req.method === 'PATCH') {
    const { username } = req.body ?? {}
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Nombre de usuario requerido' })
    }
    const clean = username.trim()
    if (clean.length < 3 || clean.length > 20) {
      return res.status(400).json({ error: 'El nombre debe tener entre 3 y 20 caracteres' })
    }
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      return res.status(400).json({ error: 'Solo letras, números y guiones bajos' })
    }

    const [existing] = await db.select({ id: users.id }).from(users)
      .where(eq(users.username, clean)).limit(1)
    if (existing && existing.id !== userId) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya está en uso' })
    }

    const [updated] = await db.update(users)
      .set({ username: clean, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ id: users.id, username: users.username, email: users.email, avatarUrl: users.avatarUrl, createdAt: users.createdAt })
    return res.json(updated)
  }

  return res.status(405).end()
}
