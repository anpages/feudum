/**
 * POST /api/armies/merchant
 * Accept or decline a pending merchant trade offer from an expedition.
 */
import { eq, and, gte } from 'drizzle-orm'
import { db, armyMissions, kingdoms, messages, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { missionId, accept } = req.body
  if (typeof missionId !== 'number' || typeof accept !== 'boolean') {
    return res.status(400).json({ error: 'missionId y accept requeridos' })
  }

  const [mission] = await db.select().from(armyMissions)
    .where(and(eq(armyMissions.id, missionId), eq(armyMissions.userId, userId)))
    .limit(1)

  if (!mission) return res.status(404).json({ error: 'Misión no encontrada' })
  if (mission.state !== 'merchant') return res.status(400).json({ error: 'La misión no tiene oferta pendiente' })

  const now = Math.floor(Date.now() / 1000)
  const parsed = mission.result ? JSON.parse(mission.result) : null
  const offer  = parsed?.merchantOffer

  if (!offer) return res.status(400).json({ error: 'Oferta no encontrada' })
  if (now >= offer.expiresAt) return res.status(400).json({ error: 'La oferta ha expirado' })

  const [homeKingdom] = await db.select().from(kingdoms)
    .where(and(
      eq(kingdoms.userId, userId),
      eq(kingdoms.realm,  mission.startRealm),
      eq(kingdoms.region, mission.startRegion),
      eq(kingdoms.slot,   mission.startSlot),
    )).limit(1)

  if (!homeKingdom) return res.status(404).json({ error: 'Reino de origen no encontrado' })

  const kingdomPatch = { updatedAt: new Date() }

  // Return expedition units regardless of accept/decline
  for (const k of UNIT_KEYS) {
    const n = mission[k] ?? 0
    if (n > 0) kingdomPatch[k] = (homeKingdom[k] ?? 0) + n
  }

  if (accept) {
    // Check player has enough resources to give
    const giveWood  = offer.give.wood  ?? 0
    const giveStone = offer.give.stone ?? 0
    const giveGrain = offer.give.grain ?? 0

    if (
      (homeKingdom.wood  ?? 0) < giveWood  ||
      (homeKingdom.stone ?? 0) < giveStone ||
      (homeKingdom.grain ?? 0) < giveGrain
    ) {
      return res.status(400).json({ error: 'No tienes suficientes recursos para el intercambio' })
    }

    // Deduct given resources
    kingdomPatch.wood  = (homeKingdom.wood  ?? 0) - giveWood
    kingdomPatch.stone = (homeKingdom.stone ?? 0) - giveStone
    kingdomPatch.grain = (homeKingdom.grain ?? 0) - giveGrain

    // Add received resources (capped at capacity)
    const recvWood  = offer.receive.wood  ?? 0
    const recvStone = offer.receive.stone ?? 0
    const recvGrain = offer.receive.grain ?? 0

    if (recvWood  > 0) kingdomPatch.wood  = Math.min((kingdomPatch.wood  ?? homeKingdom.wood)  + recvWood,  homeKingdom.woodCapacity)
    if (recvStone > 0) kingdomPatch.stone = Math.min((kingdomPatch.stone ?? homeKingdom.stone) + recvStone, homeKingdom.stoneCapacity)
    if (recvGrain > 0) kingdomPatch.grain = Math.min((kingdomPatch.grain ?? homeKingdom.grain) + recvGrain, homeKingdom.grainCapacity)
  }

  const whereClause = accept
    ? and(
        eq(kingdoms.id, homeKingdom.id),
        gte(kingdoms.wood,  offer.give.wood  ?? 0),
        gte(kingdoms.stone, offer.give.stone ?? 0),
        gte(kingdoms.grain, offer.give.grain ?? 0),
      )
    : eq(kingdoms.id, homeKingdom.id)

  const updatedRows = await db.update(kingdoms).set(kingdomPatch)
    .where(whereClause)
    .returning({ id: kingdoms.id })

  if (updatedRows.length === 0) {
    return res.status(400).json({ error: 'Recursos insuficientes para el intercambio' })
  }
  await db.delete(armyMissions).where(eq(armyMissions.id, missionId))

  await db.insert(messages).values({
    userId,
    type:    'expedition',
    subject: accept
      ? '🏪 Mercader — intercambio completado'
      : '🏪 Mercader — oferta rechazada',
    data: JSON.stringify({
      type: 'expedition',
      outcome: 'merchant',
      accepted: accept,
      offer,
    }),
  })

  return res.json({ ok: true, accepted: accept })
}
