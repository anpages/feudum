import { eq } from 'drizzle-orm'
import { db, kingdoms, buildingQueue } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { BUILDINGS, buildCost, buildTime } from '../lib/buildings.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { building: buildingId } = req.body ?? {}
  if (!buildingId) return res.status(400).json({ error: 'Falta el parámetro building' })

  const def = BUILDINGS.find(b => b.id === buildingId)
  if (!def) return res.status(400).json({ error: 'Edificio desconocido' })

  const [kingdom] = await db.select().from(kingdoms)
    .where(eq(kingdoms.userId, userId)).limit(1)
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  // ── Check requirement ─────────────────────────────────────────────────────
  if (def.requires) {
    const reqLevel = kingdom[def.requires.building] ?? 0
    if (reqLevel < def.requires.level) {
      return res.status(400).json({ error: `Requiere ${def.requires.building} nivel ${def.requires.level}` })
    }
  }

  // ── Check not already queued ──────────────────────────────────────────────
  const existing = await db.select().from(buildingQueue)
    .where(eq(buildingQueue.kingdomId, kingdom.id))

  if (existing.some(q => q.building === buildingId)) {
    return res.status(400).json({ error: 'Este edificio ya está en cola' })
  }

  // ── Calculate cost ────────────────────────────────────────────────────────
  const currentLevel  = kingdom[buildingId] ?? 0
  const nextLevel     = currentLevel + 1
  const cost          = buildCost(def.woodBase, def.stoneBase, def.factor, currentLevel)
  const workshopLevel = kingdom.workshop       ?? 0
  const egLevel       = kingdom.engineersGuild ?? 0
  const timeSecs      = buildTime(cost.wood, cost.stone, nextLevel, workshopLevel, egLevel)

  // ── Lazy resource tick before checking resources ──────────────────────────
  const now     = Math.floor(Date.now() / 1000)
  const elapsed = Math.max(0, now - kingdom.lastResourceUpdate) / 3600

  let wood  = kingdom.wood
  let stone = kingdom.stone
  let grain = kingdom.grain

  if (elapsed > 0) {
    wood  = Math.min(wood  + kingdom.woodProduction  * elapsed, kingdom.woodCapacity)
    stone = Math.min(stone + kingdom.stoneProduction * elapsed, kingdom.stoneCapacity)
    grain = Math.min(grain + kingdom.grainProduction * elapsed, kingdom.grainCapacity)
  }

  // ── Check sufficient resources ────────────────────────────────────────────
  if (wood < cost.wood) {
    return res.status(400).json({ error: 'Madera insuficiente', need: cost.wood, have: Math.floor(wood) })
  }
  if (stone < cost.stone) {
    return res.status(400).json({ error: 'Piedra insuficiente', need: cost.stone, have: Math.floor(stone) })
  }

  // ── Deduct resources and create queue entry ───────────────────────────────
  const finishesAt = now + timeSecs

  await db.update(kingdoms).set({
    wood:               wood  - cost.wood,
    stone:              stone - cost.stone,
    grain,
    lastResourceUpdate: now,
    updatedAt:          new Date(),
  }).where(eq(kingdoms.id, kingdom.id))

  const [queueItem] = await db.insert(buildingQueue).values({
    kingdomId:  kingdom.id,
    building:   buildingId,
    level:      nextLevel,
    startedAt:  now,
    finishesAt,
  }).returning()

  return res.json({
    ok:         true,
    building:   buildingId,
    level:      nextLevel,
    finishesAt,
    timeSeconds: timeSecs,
    cost,
  })
}
