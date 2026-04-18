import { eq, and } from 'drizzle-orm'
import { db, armyMissions, kingdoms } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { missionId } = req.body ?? {}
  if (!missionId) return res.status(400).json({ error: 'Falta missionId' })

  const [mission] = await db.select().from(armyMissions)
    .where(and(
      eq(armyMissions.id, parseInt(missionId, 10)),
      eq(armyMissions.userId, userId),
    )).limit(1)

  if (!mission) return res.status(404).json({ error: 'Misión no encontrada' })
  if (mission.state !== 'active') {
    return res.status(400).json({ error: 'Solo se pueden retirar misiones activas en tránsito' })
  }

  const now = Math.floor(Date.now() / 1000)
  // Return trip takes same time as elapsed so far
  const elapsed = now - mission.departureTime
  const returnTime = now + Math.max(1, elapsed)

  await db.update(armyMissions).set({
    state:      'returning',
    returnTime,
    updatedAt:  new Date(),
  }).where(eq(armyMissions.id, mission.id))

  return res.json({ ok: true, returnTime })
}
