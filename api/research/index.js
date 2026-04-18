import { eq } from 'drizzle-orm'
import { db, kingdoms, research as researchTable, researchQueue } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { RESEARCH, researchCost, researchTime, requirementsMet } from '../lib/research.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const [[kingdom], [resRow]] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    db.select().from(researchTable).where(eq(researchTable.userId, userId)).limit(1),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })
  if (!resRow)  return res.status(404).json({ error: 'Research no encontrado' })

  // ── Process finished queue items ──────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000)
  const queue = await db.select().from(researchQueue)
    .where(eq(researchQueue.userId, userId))

  let resPatch = {}
  const toDelete = []

  for (const item of queue) {
    if (item.finishesAt <= now) {
      resPatch[item.research] = item.level
      toDelete.push(item.id)
    }
  }

  if (toDelete.length > 0) {
    resPatch.updatedAt = new Date()
    await db.update(researchTable).set(resPatch).where(eq(researchTable.userId, userId))
    for (const id of toDelete) {
      await db.delete(researchQueue).where(eq(researchQueue.id, id))
    }
    const [updated] = await db.select().from(researchTable)
      .where(eq(researchTable.userId, userId)).limit(1)
    Object.assign(resRow, updated)
  }

  const activeQueue = queue.filter(item => item.finishesAt > now)
  const academyLevel = kingdom.academy ?? 0

  const result = RESEARCH.map(def => {
    const level = resRow[def.id] ?? 0
    const cost  = researchCost(def, level)
    const timeSecs = researchTime(cost.wood, cost.stone, academyLevel)
    const metReqs  = requirementsMet(def, kingdom, resRow)
    const queueItem = activeQueue.find(q => q.research === def.id)

    return {
      id:          def.id,
      level,
      costWood:    cost.wood,
      costStone:   cost.stone,
      costGrain:   cost.grain,
      timeSeconds: timeSecs,
      requiresMet: metReqs,
      requires:    def.requires,
      inQueue:     queueItem
        ? { level: queueItem.level, finishesAt: queueItem.finishesAt }
        : null,
    }
  })

  return res.json({ research: result })
}
