import { eq, and } from 'drizzle-orm'
import { db, users, kingdoms, buildingQueue, researchQueue, unitQueue, etherTransactions } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

const ETHER_PER_10MIN = 1  // 1 éter por cada 10 minutos restantes

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { queueType } = req.body ?? {}
  if (!['building', 'research', 'unit'].includes(queueType)) {
    return res.status(400).json({ error: 'Tipo de cola inválido' })
  }

  const now = Math.floor(Date.now() / 1000)

  // Load user ether + kingdom id
  const [[user], [kingdom]] = await Promise.all([
    db.select({ id: users.id, ether: users.ether }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ id: kingdoms.id }).from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
  ])
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  // Find active queue item
  let queueItem = null
  if (queueType === 'building') {
    const rows = await db.select().from(buildingQueue)
      .where(and(eq(buildingQueue.kingdomId, kingdom.id)))
      .orderBy(buildingQueue.finishesAt)
      .limit(1)
    queueItem = rows[0] ?? null
  } else if (queueType === 'research') {
    const rows = await db.select().from(researchQueue)
      .where(and(eq(researchQueue.userId, userId)))
      .orderBy(researchQueue.finishesAt)
      .limit(1)
    queueItem = rows[0] ?? null
  } else {
    const rows = await db.select().from(unitQueue)
      .where(and(eq(unitQueue.kingdomId, kingdom.id)))
      .orderBy(unitQueue.finishesAt)
      .limit(1)
    queueItem = rows[0] ?? null
  }

  if (!queueItem) return res.status(400).json({ error: 'No hay cola activa para acelerar' })

  const remaining = Math.max(0, queueItem.finishesAt - now)
  if (remaining < 2) return res.status(400).json({ error: 'La cola ya está finalizando' })

  const etherCost = Math.max(1, Math.ceil(remaining / 600))
  if ((user.ether ?? 0) < etherCost) {
    return res.status(400).json({ error: `Éter insuficiente (necesitas ${etherCost}, tienes ${user.ether ?? 0})` })
  }

  const newFinishesAt = now + Math.floor(remaining / 2)

  // Apply: halve time + deduct ether
  if (queueType === 'building') {
    await db.update(buildingQueue).set({ finishesAt: newFinishesAt }).where(eq(buildingQueue.id, queueItem.id))
  } else if (queueType === 'research') {
    await db.update(researchQueue).set({ finishesAt: newFinishesAt }).where(eq(researchQueue.id, queueItem.id))
  } else {
    await db.update(unitQueue).set({ finishesAt: newFinishesAt }).where(eq(unitQueue.id, queueItem.id))
  }

  const newEther = (user.ether ?? 0) - etherCost
  await db.update(users).set({ ether: newEther }).where(eq(users.id, userId))
  await db.insert(etherTransactions).values({
    userId,
    type: 'spend_accelerate',
    amount: -etherCost,
    reason: `Acelerar cola de ${queueType}`,
  })

  return res.json({ ok: true, finishesAt: newFinishesAt, etherCost, etherRemaining: newEther })
}
