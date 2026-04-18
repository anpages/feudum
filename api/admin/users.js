import { eq } from 'drizzle-orm'
import { db, users, kingdoms } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  if (req.method === 'GET') {
    const rows = await db
      .select({
        id:        users.id,
        username:  users.username,
        email:     users.email,
        isAdmin:   users.isAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.id)

    const kRows = await db
      .select({ id: kingdoms.id, userId: kingdoms.userId, realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot })
      .from(kingdoms)

    const kingdomByUser = Object.fromEntries(kRows.map(k => [k.userId, k]))

    return res.json({ users: rows.map(u => ({ ...u, kingdom: kingdomByUser[u.id] ?? null })) })
  }

  if (req.method === 'PATCH') {
    const { userId, isAdmin } = req.body
    if (!userId || typeof isAdmin !== 'boolean') return res.status(400).json({ error: 'bad_request' })
    if (userId === adminId) return res.status(400).json({ error: 'cannot_modify_self' })
    await db.update(users).set({ isAdmin }).where(eq(users.id, userId))
    return res.json({ ok: true })
  }

  res.status(405).end()
}
