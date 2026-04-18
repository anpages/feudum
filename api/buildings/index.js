import { eq } from 'drizzle-orm'
import { db, kingdoms, buildingQueue, research } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { BUILDINGS, buildCost, buildTime, applyBuildingEffect, buildingRequirementsMet } from '../lib/buildings.js'
import { getSettings } from '../lib/settings.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const [[kingdom], [researchRow], cfg] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    db.select().from(research).where(eq(research.userId, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  // ── Process finished queue items (lazy evaluation) ────────────────────────
  const now = Math.floor(Date.now() / 1000)
  const finished = await db.select().from(buildingQueue)
    .where(eq(buildingQueue.kingdomId, kingdom.id))

  let kingdomPatch = {}
  const toDelete = []

  for (const item of finished) {
    if (item.finishesAt <= now) {
      const newLevel = item.level
      // Pass current kingdom merged with already-queued patches so sibling effects are correct
      Object.assign(kingdomPatch, applyBuildingEffect(item.building, newLevel, { ...kingdom, ...kingdomPatch }))
      toDelete.push(item.id)
    }
  }

  if (toDelete.length > 0) {
    kingdomPatch.updatedAt = new Date()
    await db.update(kingdoms).set(kingdomPatch).where(eq(kingdoms.id, kingdom.id))
    for (const id of toDelete) {
      await db.delete(buildingQueue).where(eq(buildingQueue.id, id))
    }
    const [updated] = await db.select().from(kingdoms).where(eq(kingdoms.id, kingdom.id)).limit(1)
    Object.assign(kingdom, updated)
  }

  // ── Active queue items (not yet finished) ─────────────────────────────────
  const activeQueue = finished.filter(item => item.finishesAt > now)

  // ── Build response ────────────────────────────────────────────────────────
  const workshopLevel       = kingdom.workshop       ?? 0
  const engineersGuildLevel = kingdom.engineersGuild ?? 0

  const result = BUILDINGS.map(def => {
    const level     = kingdom[def.id] ?? 0
    const nextLevel = level + 1
    const cost      = buildCost(def.woodBase, def.stoneBase, def.factor, level, def.grainBase)
    const timeSecs  = buildTime(cost.wood, cost.stone, nextLevel, workshopLevel, engineersGuildLevel, cfg.economy_speed ?? 1)
    const queueItem = activeQueue.find(q => q.building === def.id)

    const requiresMet = buildingRequirementsMet(def, kingdom, researchRow ?? {})

    return {
      id:          def.id,
      level,
      costWood:    cost.wood,
      costStone:   cost.stone,
      costGrain:   cost.grain,
      timeSeconds: timeSecs,
      requiresMet,
      requires:    def.requires,
      inQueue:     queueItem ? { level: queueItem.level, finishesAt: queueItem.finishesAt } : null,
    }
  })

  return res.json({ buildings: result })
}
