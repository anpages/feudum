import { eq, and } from 'drizzle-orm'
import { db, kingdoms, research } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { getSettings } from '../lib/settings.js'

const MOBILE_UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

// dragonlore (plasma_technology): +1% wood, +0.66% stone, +0.33% grain per level
function effectiveProduction(kingdom, res, cfg) {
  const dl    = res?.dragonlore ?? 0
  const speed = cfg.economy_speed ?? 1
  return {
    wood:  cfg.basic_wood  + kingdom.woodProduction  * (1 + dl * 0.010)  * speed,
    stone: cfg.basic_stone + kingdom.stoneProduction * (1 + dl * 0.0066) * speed,
    grain:                   kingdom.grainProduction * (1 + dl * 0.0033) * speed,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  // Optional ?id= to select a specific kingdom (colony management)
  const requestedId = req.query.id ? parseInt(req.query.id, 10) : null

  const whereClause = requestedId
    ? and(eq(kingdoms.userId, userId), eq(kingdoms.id, requestedId))
    : eq(kingdoms.userId, userId)

  const [[kingdom], [researchRow], cfg] = await Promise.all([
    db.select().from(kingdoms).where(whereClause).limit(1),
    db.select().from(research).where(eq(research.userId, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  const eff            = effectiveProduction(kingdom, researchRow, cfg)
  const now            = Math.floor(Date.now() / 1000)
  const elapsed        = Math.max(0, now - kingdom.lastResourceUpdate) / 3600
  const populationUsed = MOBILE_UNIT_KEYS.reduce((s, k) => s + (kingdom[k] ?? 0), 0)

  if (elapsed > 0) {
    const wood  = Math.min(kingdom.wood  + eff.wood  * elapsed, kingdom.woodCapacity)
    const stone = Math.min(kingdom.stone + eff.stone * elapsed, kingdom.stoneCapacity)
    const grain = Math.min(kingdom.grain + eff.grain * elapsed, kingdom.grainCapacity)

    const [updated] = await db.update(kingdoms)
      .set({ wood, stone, grain, populationUsed, lastResourceUpdate: now, updatedAt: new Date() })
      .where(eq(kingdoms.id, kingdom.id))
      .returning()

    return res.json({ ...updated, woodProduction: eff.wood, stoneProduction: eff.stone, grainProduction: eff.grain })
  }

  if (populationUsed !== kingdom.populationUsed) {
    await db.update(kingdoms)
      .set({ populationUsed, updatedAt: new Date() })
      .where(eq(kingdoms.id, kingdom.id))
  }

  return res.json({ ...kingdom, populationUsed, woodProduction: eff.wood, stoneProduction: eff.stone, grainProduction: eff.grain })
}
