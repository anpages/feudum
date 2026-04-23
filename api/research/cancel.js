import { eq } from 'drizzle-orm'
import { db, kingdoms, researchQueue, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { RESEARCH, researchCost } from '../lib/research.js'
import { applyResourceTick } from '../lib/tick.js'
import { getSettings } from '../lib/settings.js'
import { processUserQueues } from '../lib/process-queues.js'
import { enrichKingdom, getResearchMap } from '../lib/db-helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { queueId } = req.body ?? {}
  if (!queueId) return res.status(400).json({ error: 'Falta queueId' })

  await processUserQueues(userId)

  const [[kingdomRow], resMap, [userRow], cfg] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    getResearchMap(userId),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdomRow) return res.status(404).json({ error: 'Reino no encontrado' })
  const kingdom = await enrichKingdom(kingdomRow)

  const allQueue = await db.select().from(researchQueue)
    .where(eq(researchQueue.userId, userId))
  const item = allQueue.find(q => q.id === queueId)
  if (!item) return res.status(404).json({ error: 'Elemento de cola no encontrado' })

  const def = RESEARCH.find(r => r.id === item.researchType)
  if (!def) return res.status(404).json({ error: 'Investigación desconocida' })

  const currentLevel = item.level - 1
  const refund = researchCost(def, currentLevel)

  const { wood, stone, grain, now } = applyResourceTick(kingdom, cfg, userRow?.characterClass ?? null, resMap)

  await db.delete(researchQueue).where(eq(researchQueue.id, queueId))

  const newWood  = Math.min(wood  + refund.wood,  kingdom.woodCapacity  ?? 999999)
  const newStone = Math.min(stone + refund.stone, kingdom.stoneCapacity ?? 999999)
  const newGrain = Math.min(grain + refund.grain, kingdom.grainCapacity ?? 999999)

  await db.update(kingdoms).set({
    wood: newWood, stone: newStone, grain: newGrain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, kingdom.id))

  // Rechain subsequent research items
  const remaining = allQueue
    .filter(q => q.id !== queueId)
    .sort((a, b) => a.finishesAt - b.finishesAt)

  const cancelledIndex = allQueue
    .sort((a, b) => a.finishesAt - b.finishesAt)
    .findIndex(q => q.id === queueId)

  const itemsAfter = remaining.slice(cancelledIndex)
  if (itemsAfter.length > 0) {
    const predecessor = cancelledIndex > 0 ? remaining[cancelledIndex - 1] : null
    let chainAt = predecessor ? predecessor.finishesAt : now
    for (const q of itemsAfter) {
      const duration = q.finishesAt - q.startedAt
      const newStartedAt  = Math.max(now, chainAt)
      const newFinishesAt = newStartedAt + duration
      await db.update(researchQueue)
        .set({ startedAt: newStartedAt, finishesAt: newFinishesAt })
        .where(eq(researchQueue.id, q.id))
      chainAt = newFinishesAt
    }
  }

  return res.json({ ok: true, refund })
}
