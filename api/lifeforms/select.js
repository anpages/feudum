import { eq } from 'drizzle-orm'
import { db, kingdoms } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { CIVILIZATIONS } from '../lib/lifeforms.js'

const VALID_CIVS = CIVILIZATIONS.map(c => c.id)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { civilization } = req.body ?? {}
  if (!civilization || !VALID_CIVS.includes(civilization)) {
    return res.status(400).json({ error: 'Civilización no válida' })
  }

  const [[kingdom]] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  // Can only select a civilization if none is chosen yet
  if (kingdom.civilization) {
    return res.status(400).json({ error: 'Ya tienes una civilización asignada a este reino' })
  }

  await db.update(kingdoms)
    .set({ civilization, updatedAt: new Date() })
    .where(eq(kingdoms.id, kingdom.id))

  return res.json({ ok: true, civilization })
}
