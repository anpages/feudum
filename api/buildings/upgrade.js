import { eq, and, asc } from 'drizzle-orm'
import { db, kingdoms, buildingQueue, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { BUILDINGS, buildCost, buildTime, buildingRequirementsMet, calcFieldMax, calcFieldsUsed } from '../lib/buildings.js'
import { getSettings } from '../lib/settings.js'
import { applyResourceTick } from '../lib/tick.js'
import { getPoiBonusForKingdom } from '../lib/poi-bonus.js'
import { processUserQueues } from '../lib/process-queues.js'
import { enrichKingdom, getResearchMap } from '../lib/db-helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { building: buildingId, kingdomId: reqKingdomId } = req.body ?? {}
  if (!buildingId) return res.status(400).json({ error: 'Falta el parámetro building' })

  const def = BUILDINGS.find(b => b.id === buildingId)
  if (!def) return res.status(400).json({ error: 'Edificio desconocido' })

  // Apply any completed queues so this mutation sees authoritative state.
  await processUserQueues(userId)

  const kingdomQuery = reqKingdomId
    ? db.select().from(kingdoms).where(and(eq(kingdoms.id, reqKingdomId), eq(kingdoms.userId, userId))).limit(1)
    : db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).orderBy(asc(kingdoms.createdAt)).limit(1)

  const [[kingdomRow], resMap, [userRow], cfg] = await Promise.all([
    kingdomQuery,
    getResearchMap(userId),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdomRow) return res.status(404).json({ error: 'Reino no encontrado' })

  const kingdom = await enrichKingdom(kingdomRow)

  // ── Check requirements ────────────────────────────────────────────────────
  if (!buildingRequirementsMet(def, kingdom, resMap)) {
    return res.status(400).json({ error: 'Requisitos no cumplidos' })
  }

  // ── Check building field limit (alchemistTower expands it) ──────────────────
  const fieldsUsed = calcFieldsUsed(kingdom)
  const fieldMax   = calcFieldMax(kingdom.alchemistTower ?? 0)
  if (fieldsUsed >= fieldMax) {
    return res.status(400).json({
      error: `Campos de construcción llenos (${fieldsUsed}/${fieldMax}). Sube el Expansor de Dominio para ampliarlos.`,
    })
  }

  // ── Check not already queued + queue limit (max 5) ────────────────────────
  const existing = await db.select().from(buildingQueue)
    .where(eq(buildingQueue.kingdomId, kingdom.id))
  if (existing.some(q => q.buildingType === buildingId)) {
    return res.status(400).json({ error: 'Este edificio ya está en cola' })
  }
  if (existing.length >= 5) {
    return res.status(400).json({ error: 'Cola llena (máximo 5 construcciones)' })
  }

  // ── Calculate cost ────────────────────────────────────────────────────────
  const currentLevel  = kingdom[buildingId] ?? 0
  const nextLevel     = currentLevel + 1
  const cost          = buildCost(def.woodBase, def.stoneBase, def.factor, currentLevel, def.grainBase)
  const workshopLevel = kingdom.workshop       ?? 0
  const egLevel       = kingdom.engineersGuild ?? 0
  const timeSecs      = buildTime(cost.wood, cost.stone, nextLevel, workshopLevel, egLevel, cfg.economy_speed)

  // ── Lazy resource tick ────────────────────────────────────────────────────
  const poiBonus = await getPoiBonusForKingdom(kingdom.id)
  const { wood, stone, grain, now } = applyResourceTick(kingdom, cfg, userRow?.characterClass ?? null, resMap, poiBonus)

  // ── Check sufficient resources ────────────────────────────────────────────
  if (wood  < cost.wood)  return res.status(400).json({ error: 'Madera insuficiente',  need: cost.wood,  have: Math.floor(wood)  })
  if (stone < cost.stone) return res.status(400).json({ error: 'Piedra insuficiente',  need: cost.stone, have: Math.floor(stone) })
  if (grain < cost.grain) return res.status(400).json({ error: 'Grano insuficiente',   need: cost.grain, have: Math.floor(grain) })

  // ── Deduct resources and create queue entry ───────────────────────────────
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

  await db.insert(buildingQueue).values({
    kingdomId:    kingdom.id,
    buildingType: buildingId,
    level:        nextLevel,
    startedAt:    startAt,
    finishesAt,
  })

  return res.json({ ok: true, building: buildingId, level: nextLevel, finishesAt, timeSeconds: timeSecs, cost })
}
