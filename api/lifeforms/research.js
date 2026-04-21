import { eq, and } from 'drizzle-orm'
import { db, kingdoms, lfResearchQueue } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import {
  LF_RESEARCH_BY_ID, lfResearchCost, lfResearchTime, unlockedTiers,
} from '../lib/lifeforms.js'
import { getSettings } from '../lib/settings.js'
import { applyResourceTick } from '../lib/tick.js'
import { processUserQueues } from '../lib/process-queues.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { research: researchId } = req.body ?? {}
  if (!researchId) return res.status(400).json({ error: 'Falta el parámetro research' })

  const def = LF_RESEARCH_BY_ID[researchId]
  if (!def) return res.status(400).json({ error: 'Investigación desconocida' })

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
    return res.status(400).json({ error: 'Esta investigación pertenece a otra civilización' })
  }

  // Tier check
  const lfLevels = (kingdom.lfBuildings ?? {})
  const popTotal = kingdom.populationT1 + kingdom.populationT2 + kingdom.populationT3
  const torreMuecinLv = lfLevels['torreMuecin'] ?? 0
  const tiers = unlockedTiers(popTotal, kingdom.artifacts, torreMuecinLv)

  if (def.tier === 2 && !tiers.t2) {
    return res.status(400).json({ error: `Requiere ${(1_200_000).toLocaleString()} de población y ${400} artefactos para tier 2` })
  }
  if (def.tier === 3 && !tiers.t3) {
    return res.status(400).json({ error: `Requiere ${(13_000_000).toLocaleString()} de población y ${600} artefactos para tier 3` })
  }

  // Only 1 active LF research at a time
  const existingQueue = await db.select().from(lfResearchQueue)
    .where(eq(lfResearchQueue.kingdomId, kingdom.id))

  if (existingQueue.length > 0) {
    return res.status(400).json({ error: 'Ya hay una investigación de civilización en curso' })
  }

  const lfResLvls    = (kingdom.lfResearch ?? {})
  const currentLevel = lfResLvls[researchId] ?? 0
  const nextLevel    = currentLevel + 1
  const cost         = lfResearchCost(def, nextLevel)
  const speed        = parseFloat(cfg.economy_speed ?? '1')
  const timeSecs     = lfResearchTime(def, nextLevel, speed)

  const { wood, stone, grain, now } = applyResourceTick(kingdom, cfg, null, null)

  if (wood  < cost.wood)  return res.status(400).json({ error: 'Madera insuficiente',  need: cost.wood,  have: Math.floor(wood)  })
  if (stone < cost.stone) return res.status(400).json({ error: 'Piedra insuficiente',  need: cost.stone, have: Math.floor(stone) })
  if (grain < cost.grain) return res.status(400).json({ error: 'Grano insuficiente',   need: cost.grain, have: Math.floor(grain) })

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

  const finishesAt = now + timeSecs
  await db.insert(lfResearchQueue).values({
    kingdomId: kingdom.id,
    research:  researchId,
    level:     nextLevel,
    startedAt: now,
    finishesAt,
  })

  return res.json({ ok: true, research: researchId, level: nextLevel, finishesAt, timeSeconds: timeSecs, cost })
}
