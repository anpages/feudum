import { eq, and } from 'drizzle-orm'
import { db, kingdoms } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

export default async function handler(req, res) {
  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  // ── PATCH — rename kingdom ─────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { name, id: bodyId } = req.body ?? {}
    const kingdomId = bodyId ? String(bodyId) : null
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Nombre requerido' })
    const clean = name.trim()
    if (clean.length < 3 || clean.length > 50) return res.status(400).json({ error: 'El nombre debe tener entre 3 y 50 caracteres' })
    const whereK = kingdomId
      ? and(eq(kingdoms.userId, userId), eq(kingdoms.id, kingdomId))
      : eq(kingdoms.userId, userId)
    const [updated] = await db.update(kingdoms)
      .set({ name: clean, updatedAt: new Date() })
      .where(whereK)
      .returning()
    if (!updated) return res.status(404).json({ error: 'Reino no encontrado' })
    return res.json({ ok: true, name: updated.name })
  }

  // ── DELETE — abandon colony ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const targetId = req.query.id ? String(req.query.id) : null
    if (!targetId) return res.status(400).json({ error: 'id requerido' })
    const allKingdoms = await db.select({ id: kingdoms.id })
      .from(kingdoms).where(eq(kingdoms.userId, userId))
    if (allKingdoms.length <= 1) return res.status(400).json({ error: 'No puedes abandonar tu único reino' })
    const target = allKingdoms.find(k => k.id === targetId)
    if (!target) return res.status(404).json({ error: 'Reino no encontrado' })
    await db.delete(kingdoms).where(and(eq(kingdoms.id, targetId), eq(kingdoms.userId, userId)))
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
