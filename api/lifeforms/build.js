import { eq, and } from 'drizzle-orm'
import { db, kingdoms, lfBuildingQueue } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import {
  LF_BUILDINGS_BY_ID, lfBuildingCost, lfBuildingTime,
  lfBuildingRequirementsMet,
} from '../lib/lifeforms.js'
import { getSettings } from '../lib/settings.js'
import { applyResourceTick } from '../lib/tick.js'
import { processUserQueues } from '../lib/process-queues.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { building: buildingId } = req.body ?? {}
  if (!buildingId) return res.status(400).json({ error: 'Falta el parámetro building' })

  const def = LF_BUILDINGS_BY_ID[buildingId]
  if (!def) return res.status(400).json({ error: 'Edificio desconocido' })

  await processUserQueues(userId)

  const [[kingdom], cfg] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  if (!kingdom.civilization) {
    return res.status(400).json({ error: 'Elige una civilización primero' })
  }
  if (def.civilization !== kingdom.civilization) {
    return res.status(400).json({ error: 'Este edificio pertenece a otra civilización' })
  }

  const lfLevels = (kingdom.lfBuildings ?? {})
  const popTotal = kingdom.populationT1 + kingdom.populationT2 + kingdom.populationT3

  if (!lfBuildingRequirementsMet(def, lfLevels, popTotal)) {
    return res.status(400).json({ error: 'Requisitos no cumplidos' })
  }

  // Queue: only 1 LF building at a time per kingdom (like OGame separate queue)
  const existingQueue = await db.select().from(lfBuildingQueue)
    .where(eq(lfBuildingQueue.kingdomId, kingdom.id))

  if (existingQueue.length >= 5) {
    return res.status(400).json({ error: 'Cola de civilización llena (máximo 5)' })
  }
  if (existingQueue.some(q => q.building === buildingId)) {
    return res.status(400).json({ error: 'Este edificio ya está en cola' })
  }

  const currentLevel  = lfLevels[buildingId] ?? 0
  const nextLevel     = currentLevel + 1
  const cost          = lfBuildingCost(def, nextLevel)
  const speed         = parseFloat(cfg.economy_speed ?? '1')
  const workshopLevel = kingdom.workshop      ?? 0
  const naniteLevel   = kingdom.engineersGuild ?? 0
  const timeSecs      = lfBuildingTime(def, nextLevel, workshopLevel, naniteLevel, speed)

  const { wood, stone, grain, now } = applyResourceTick(kingdom, cfg, null, null)

  if (wood  < cost.wood)  return res.status(400).json({ error: 'Madera insuficiente',  need: cost.wood,  have: Math.floor(wood)  })
  if (stone < cost.stone) return res.status(400).json({ error: 'Piedra insuficiente',  need: cost.stone, have: Math.floor(stone) })
  if (grain < cost.grain) return res.status(400).json({ error: 'Grano insuficiente',   need: cost.grain, have: Math.floor(grain) })

  const lastQueuedAt = existingQueue.length > 0
    ? Math.max(...existingQueue.map(q => q.finishesAt))
    : now
  const startAt    = Math.max(now, lastQueuedAt)
  const finishesAt = startAt + timeSecs

  const updated = await db.update(kingdoms).set({
    wood:  wood  - cost.wood,
    stone: stone - cost.stone,
    grain: grain - cost.grain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }).where(and(
    eq(kingdoms.id, kingdom.id),
    eq(kingdoms.lastResourceUpdate, kingdom.lastResourceUpdate),
  )).returning({ id: kingdoms.id })

  if (updated.length === 0) {
    return res.status(409).json({ error: 'Conflicto de concurrencia, inténtalo de nuevo' })
  }

  await db.insert(lfBuildingQueue).values({
    kingdomId: kingdom.id,
    building:  buildingId,
    level:     nextLevel,
    startedAt: startAt,
    finishesAt,
  })

  return res.json({ ok: true, building: buildingId, level: nextLevel, finishesAt, timeSeconds: timeSecs, cost })
}
