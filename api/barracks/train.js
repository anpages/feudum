import { eq, and } from 'drizzle-orm'
import { db, kingdoms, unitQueue, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { ALL_UNITS, unitBuildTime, unitRequirementsMet } from '../lib/units.js'
import { getSettings } from '../lib/settings.js'
import { applyResourceTick } from '../lib/tick.js'
import { processUserQueues } from '../lib/process-queues.js'
import { enrichKingdom, getResearchMap } from '../lib/db-helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { unit: unitId, amount: rawAmount } = req.body ?? {}
  const amount = parseInt(rawAmount, 10)

  if (!unitId)          return res.status(400).json({ error: 'Falta el parámetro unit' })
  if (!amount || amount < 1) return res.status(400).json({ error: 'Cantidad inválida' })
  if (amount > 10000)   return res.status(400).json({ error: 'Máximo 10.000 unidades por orden' })

  const def = ALL_UNITS.find(u => u.id === unitId)
  if (!def) return res.status(400).json({ error: 'Unidad desconocida' })

  await processUserQueues(userId)

  const [[kingdomRow], resMap, [userRow], cfg] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    getResearchMap(userId),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdomRow) return res.status(404).json({ error: 'Reino no encontrado' })
  const kingdom = await enrichKingdom(kingdomRow, { withUnits: true })

  // ── Requirements ──────────────────────────────────────────────────────────
  if (!unitRequirementsMet(def, kingdom, resMap)) {
    return res.status(400).json({ error: 'Requisitos no cumplidos' })
  }

  // ── Single shared queue for all units — fetch existing to chain ──────────
  const existingQueue = await db.select().from(unitQueue)
    .where(eq(unitQueue.kingdomId, kingdom.id))

  // ── Lazy resource tick ────────────────────────────────────────────────────
  const { wood, stone, grain, now } = applyResourceTick(kingdom, cfg, userRow?.characterClass ?? null, resMap)

  const totalWood  = def.woodBase  * amount
  const totalStone = def.stoneBase * amount
  const totalGrain = def.grainBase * amount

  if (wood  < totalWood)  return res.status(400).json({ error: 'Madera insuficiente',  need: totalWood,  have: Math.floor(wood) })
  if (stone < totalStone) return res.status(400).json({ error: 'Piedra insuficiente',  need: totalStone, have: Math.floor(stone) })
  if (grain < totalGrain) return res.status(400).json({ error: 'Grano insuficiente',   need: totalGrain, have: Math.floor(grain) })

  // ── Calculate build time — chain after last queued item ──────────────────
  const barracksLv = kingdom.barracks       ?? 0
  const egLv       = kingdom.engineersGuild ?? 0
  const timeSecs   = unitBuildTime(def.hull, barracksLv, egLv, amount, cfg.economy_speed ?? 1)
  const lastQueuedAt = existingQueue.length > 0
    ? Math.max(...existingQueue.map(q => q.finishesAt))
    : now
  const startAt    = Math.max(now, lastQueuedAt)
  const finishesAt = startAt + timeSecs

  const updated = await db.update(kingdoms).set({
    wood:  wood  - totalWood,
    stone: stone - totalStone,
    grain: grain - totalGrain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }).where(and(
    eq(kingdoms.id, kingdom.id),
    eq(kingdoms.lastResourceUpdate, kingdom.lastResourceUpdate),
  )).returning({ id: kingdoms.id })

  if (updated.length === 0) {
    return res.status(409).json({ error: 'Conflicto de concurrencia, inténtalo de nuevo' })
  }

  await db.insert(unitQueue).values({
    kingdomId: kingdom.id,
    unitType:  unitId,
    amount,
    startedAt: startAt,
    finishesAt,
  })

  return res.json({ ok: true, unit: unitId, amount, finishesAt, timeSeconds: timeSecs })
}
