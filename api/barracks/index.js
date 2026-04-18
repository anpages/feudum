import { eq } from 'drizzle-orm'
import { db, kingdoms, research as researchTable, unitQueue } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { UNITS, SUPPORT_UNITS, DEFENSES, unitBuildTime, unitRequirementsMet } from '../lib/units.js'

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
  const now   = Math.floor(Date.now() / 1000)
  const queue = await db.select().from(unitQueue)
    .where(eq(unitQueue.kingdomId, kingdom.id))

  const patch   = {}
  const toDelete = []

  for (const item of queue) {
    if (item.finishesAt <= now) {
      patch[item.unit] = (kingdom[item.unit] ?? 0) + item.amount
      toDelete.push(item.id)
    }
  }

  if (toDelete.length > 0) {
    patch.updatedAt = new Date()
    await db.update(kingdoms).set(patch).where(eq(kingdoms.id, kingdom.id))
    for (const id of toDelete) {
      await db.delete(unitQueue).where(eq(unitQueue.id, id))
    }
    const [updated] = await db.select().from(kingdoms)
      .where(eq(kingdoms.id, kingdom.id)).limit(1)
    Object.assign(kingdom, updated)
  }

  const activeQueue = queue.filter(q => q.finishesAt > now)
  const barracksLv  = kingdom.barracks       ?? 0
  const egLv        = kingdom.engineersGuild ?? 0

  const mapUnit = def => {
    const count    = kingdom[def.id] ?? 0
    const timePer  = unitBuildTime(def.hull, barracksLv, egLv, 1)
    const metReqs  = unitRequirementsMet(def, kingdom, resRow)
    const queueItem = activeQueue.find(q => q.unit === def.id)
    return {
      id:          def.id,
      count,
      woodBase:    def.woodBase,
      stoneBase:   def.stoneBase,
      grainBase:   def.grainBase,
      hull:        def.hull,
      shield:      def.shield,
      attack:      def.attack,
      timePerUnit: timePer,
      requiresMet: metReqs,
      requires:    def.requires,
      inQueue:     queueItem
        ? { amount: queueItem.amount, finishesAt: queueItem.finishesAt }
        : null,
    }
  }

  return res.json({
    units:   UNITS.map(mapUnit),
    support: SUPPORT_UNITS.map(mapUnit),
    defenses: DEFENSES.map(mapUnit),
  })
}
