import { eq } from 'drizzle-orm'
import { db, kingdoms, research as researchTable, researchQueue } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { RESEARCH, researchCost, researchTime, requirementsMet } from '../lib/research.js'
import { getSettings } from '../lib/settings.js'
import { applyResourceTick } from '../lib/tick.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { research: researchId } = req.body ?? {}
  if (!researchId) return res.status(400).json({ error: 'Falta el parámetro research' })

  const def = RESEARCH.find(r => r.id === researchId)
  if (!def) return res.status(400).json({ error: 'Investigación desconocida' })

  const [[kingdom], [resRow], cfg] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    db.select().from(researchTable).where(eq(researchTable.userId, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })
  if (!resRow)  return res.status(404).json({ error: 'Research no encontrado' })

  // ── One active research at a time per player ──────────────────────────────
  const existing = await db.select().from(researchQueue)
    .where(eq(researchQueue.userId, userId))
  if (existing.length > 0) {
    return res.status(400).json({ error: 'Ya hay una investigación en curso' })
  }

  // ── Requirements ──────────────────────────────────────────────────────────
  if (!requirementsMet(def, kingdom, resRow)) {
    return res.status(400).json({ error: 'Requisitos no cumplidos' })
  }

  // ── Cost ──────────────────────────────────────────────────────────────────
  const currentLevel  = resRow[researchId] ?? 0
  const nextLevel     = currentLevel + 1
  const academyLevel  = kingdom.academy ?? 0
  const cost          = researchCost(def, currentLevel)
  const timeSecs      = researchTime(cost.wood, cost.stone, academyLevel, cfg.research_speed ?? 1)

  // ── Lazy resource tick ────────────────────────────────────────────────────
  const { wood, stone, grain, now } = applyResourceTick(kingdom, cfg)

  // ── Check resources ───────────────────────────────────────────────────────
  if (wood  < cost.wood)  return res.status(400).json({ error: 'Madera insuficiente',  need: cost.wood,  have: Math.floor(wood) })
  if (stone < cost.stone) return res.status(400).json({ error: 'Piedra insuficiente',  need: cost.stone, have: Math.floor(stone) })
  if (grain < cost.grain) return res.status(400).json({ error: 'Grano insuficiente',   need: cost.grain, have: Math.floor(grain) })

  const finishesAt = now + timeSecs

  await db.update(kingdoms).set({
    wood:  wood  - cost.wood,
    stone: stone - cost.stone,
    grain: grain - cost.grain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, kingdom.id))

  await db.insert(researchQueue).values({
    userId,
    kingdomId:  kingdom.id,
    research:   researchId,
    level:      nextLevel,
    startedAt:  now,
    finishesAt,
  })

  return res.json({ ok: true, research: researchId, level: nextLevel, finishesAt, timeSeconds: timeSecs, cost })
}
