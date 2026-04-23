import { eq, and } from 'drizzle-orm'
import { db, kingdoms, researchQueue, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { RESEARCH, researchCost, researchTime, requirementsMet } from '../lib/research.js'
import { getSettings } from '../lib/settings.js'
import { applyResourceTick } from '../lib/tick.js'
import { processUserQueues } from '../lib/process-queues.js'
import { enrichKingdom, getResearchMap } from '../lib/db-helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { research: researchId } = req.body ?? {}
  if (!researchId) return res.status(400).json({ error: 'Falta el parámetro research' })

  const def = RESEARCH.find(r => r.id === researchId)
  if (!def) return res.status(400).json({ error: 'Investigación desconocida' })

  await processUserQueues(userId)

  const [[kingdomRow], resMap, [userRow], cfg] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    getResearchMap(userId),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdomRow) return res.status(404).json({ error: 'Reino no encontrado' })
  const kingdom = await enrichKingdom(kingdomRow)

  // ── Queue limit (max 5) ────────────────────────────────────────────────────
  const existing = await db.select().from(researchQueue)
    .where(eq(researchQueue.userId, userId))
  if (existing.some(q => q.researchType === researchId)) {
    return res.status(400).json({ error: 'Esta investigación ya está en cola' })
  }
  if (existing.length >= 5) {
    return res.status(400).json({ error: 'Cola llena (máximo 5 investigaciones)' })
  }

  // ── Requirements ──────────────────────────────────────────────────────────
  if (!requirementsMet(def, kingdom, resMap)) {
    return res.status(400).json({ error: 'Requisitos no cumplidos' })
  }

  // ── Cost ──────────────────────────────────────────────────────────────────
  const currentLevel  = resMap[researchId] ?? 0
  const nextLevel     = currentLevel + 1
  const academyLevel  = kingdom.academy ?? 0
  const cost          = researchCost(def, currentLevel)
  const baseTime      = researchTime(cost.wood, cost.stone, academyLevel, cfg.research_speed ?? 1)
  const classMult = userRow?.characterClass === 'discoverer' ? 0.75 : 1.0
  const timeSecs  = Math.max(1, Math.floor(baseTime * classMult))

  // ── Lazy resource tick ────────────────────────────────────────────────────
  const { wood, stone, grain, now } = applyResourceTick(kingdom, cfg, userRow?.characterClass ?? null, resMap)

  // ── Check resources ───────────────────────────────────────────────────────
  if (wood  < cost.wood)  return res.status(400).json({ error: 'Madera insuficiente',  need: cost.wood,  have: Math.floor(wood) })
  if (stone < cost.stone) return res.status(400).json({ error: 'Piedra insuficiente',  need: cost.stone, have: Math.floor(stone) })
  if (grain < cost.grain) return res.status(400).json({ error: 'Grano insuficiente',   need: cost.grain, have: Math.floor(grain) })

  // Chain after the last queued item so researches are processed in series
  const lastQueuedAt = existing.length > 0
    ? Math.max(...existing.map(q => q.finishesAt))
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

  await db.insert(researchQueue).values({
    userId,
    kingdomId:    kingdom.id,
    researchType: researchId,
    level:        nextLevel,
    startedAt:    startAt,
    finishesAt,
  })

  return res.json({ ok: true, research: researchId, level: nextLevel, finishesAt, timeSeconds: timeSecs, cost })
}
