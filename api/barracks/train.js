import { eq } from 'drizzle-orm'
import { db, kingdoms, research as researchTable, unitQueue } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { ALL_UNITS, unitBuildTime, unitRequirementsMet } from '../lib/units.js'
import { getSettings } from '../lib/settings.js'

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

  const [[kingdom], [resRow], cfg] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    db.select().from(researchTable).where(eq(researchTable.userId, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })
  if (!resRow)  return res.status(404).json({ error: 'Research no encontrado' })

  // ── Requirements ──────────────────────────────────────────────────────────
  if (!unitRequirementsMet(def, kingdom, resRow)) {
    return res.status(400).json({ error: 'Requisitos no cumplidos' })
  }

  // ── Check not already in queue for this unit ──────────────────────────────
  const existingQueue = await db.select().from(unitQueue)
    .where(eq(unitQueue.kingdomId, kingdom.id))
  if (existingQueue.some(q => q.unit === unitId && q.finishesAt > Math.floor(Date.now() / 1000))) {
    return res.status(400).json({ error: 'Esta unidad ya está en producción' })
  }

  // ── Lazy resource tick ────────────────────────────────────────────────────
  const now     = Math.floor(Date.now() / 1000)
  const elapsed = Math.max(0, now - kingdom.lastResourceUpdate) / 3600

  const econSpeed = cfg.economy_speed ?? 1
  let wood  = Math.min(kingdom.wood  + kingdom.woodProduction  * elapsed * econSpeed, kingdom.woodCapacity)
  let stone = Math.min(kingdom.stone + kingdom.stoneProduction * elapsed * econSpeed, kingdom.stoneCapacity)
  let grain = Math.min(kingdom.grain + kingdom.grainProduction * elapsed * econSpeed, kingdom.grainCapacity)

  const totalWood  = def.woodBase  * amount
  const totalStone = def.stoneBase * amount
  const totalGrain = def.grainBase * amount

  if (wood  < totalWood)  return res.status(400).json({ error: 'Madera insuficiente',  need: totalWood,  have: Math.floor(wood) })
  if (stone < totalStone) return res.status(400).json({ error: 'Piedra insuficiente',  need: totalStone, have: Math.floor(stone) })
  if (grain < totalGrain) return res.status(400).json({ error: 'Grano insuficiente',   need: totalGrain, have: Math.floor(grain) })

  // ── Calculate build time ──────────────────────────────────────────────────
  const barracksLv = kingdom.barracks       ?? 0
  const egLv       = kingdom.engineersGuild ?? 0
  const timeSecs   = unitBuildTime(def.hull, barracksLv, egLv, amount, cfg.economy_speed ?? 1)
  const finishesAt = now + timeSecs

  await db.update(kingdoms).set({
    wood:  wood  - totalWood,
    stone: stone - totalStone,
    grain: grain - totalGrain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, kingdom.id))

  await db.insert(unitQueue).values({
    kingdomId: kingdom.id,
    unit:      unitId,
    amount,
    startedAt: now,
    finishesAt,
  })

  return res.json({ ok: true, unit: unitId, amount, finishesAt, timeSeconds: timeSecs })
}
