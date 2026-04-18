import { eq, and, gte } from 'drizzle-orm'
import { db, kingdoms, research as researchTable, researchQueue, users } from '../_db.js'
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

  const [[kingdom], [resRow], [userRow], cfg] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    db.select().from(researchTable).where(eq(researchTable.userId, userId)).limit(1),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, userId)).limit(1),
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
  const baseTime      = researchTime(cost.wood, cost.stone, academyLevel, cfg.research_speed ?? 1)
  // Discoverer class: -25% research time
  const timeSecs      = userRow?.characterClass === 'discoverer' ? Math.max(1, Math.floor(baseTime * 0.75)) : baseTime

  // ── Lazy resource tick ────────────────────────────────────────────────────
  const { wood, stone, grain, now } = applyResourceTick(kingdom, cfg)

  // ── Check resources ───────────────────────────────────────────────────────
  if (wood  < cost.wood)  return res.status(400).json({ error: 'Madera insuficiente',  need: cost.wood,  have: Math.floor(wood) })
  if (stone < cost.stone) return res.status(400).json({ error: 'Piedra insuficiente',  need: cost.stone, have: Math.floor(stone) })
  if (grain < cost.grain) return res.status(400).json({ error: 'Grano insuficiente',   need: cost.grain, have: Math.floor(grain) })

  const finishesAt = now + timeSecs

  const updated = await db.update(kingdoms).set({
    wood:  wood  - cost.wood,
    stone: stone - cost.stone,
    grain: grain - cost.grain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }).where(and(
    eq(kingdoms.id, kingdom.id),
    eq(kingdoms.lastResourceUpdate, kingdom.lastResourceUpdate),
    gte(kingdoms.wood,  cost.wood),
    gte(kingdoms.stone, cost.stone),
    gte(kingdoms.grain, cost.grain),
  )).returning({ id: kingdoms.id })

  if (updated.length === 0) {
    return res.status(409).json({ error: 'Conflicto de concurrencia, inténtalo de nuevo' })
  }

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
