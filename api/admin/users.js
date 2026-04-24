import { eq } from 'drizzle-orm'
import { db, users, kingdoms } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { getSupabaseAdmin } from '../lib/supabase.js'

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  if (req.method === 'GET') {
    const rows = await db
      .select({
        id:        users.id,
        username:  users.username,
        email:     users.email,
        role:      users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.id)

    const kRows = await db
      .select({ id: kingdoms.id, userId: kingdoms.userId, realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot })
      .from(kingdoms)

    const kingdomByUser = Object.fromEntries(kRows.map(k => [k.userId, k]))

    return res.json({ users: rows.map(u => ({ ...u, isNpc: u.role === 'npc', kingdom: kingdomByUser[u.id] ?? null })) })
  }

  if (req.method === 'PATCH') {
    const { userId, isAdmin } = req.body
    if (!userId || typeof isAdmin !== 'boolean') return res.status(400).json({ error: 'bad_request' })
    if (userId === adminId) return res.status(400).json({ error: 'cannot_modify_self' })
    await db.update(users).set({ role: isAdmin ? 'admin' : 'human' }).where(eq(users.id, userId))
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'bad_request' })

    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
    if (!target) return res.status(404).json({ error: 'user_not_found' })
    if (target.role === 'admin') return res.status(400).json({ error: 'cannot_delete_admin' })

    // Delete from public.users (cascades to kingdoms, research, etc.)
    await db.delete(users).where(eq(users.id, userId))

    // Delete from Supabase auth.users (requires service role)
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId)
    if (error) console.error('[admin/users] deleteUser auth error:', error.message)

    return res.json({ ok: true })
  }

  res.status(405).end()
}
