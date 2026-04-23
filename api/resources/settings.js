import { eq, and } from 'drizzle-orm'
import { db, kingdoms } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { getSettings } from '../lib/settings.js'

const PERCENT_KEYS = ['sawmillPercent', 'quarryPercent', 'grainFarmPercent', 'windmillPercent', 'cathedralPercent']
const PERCENT_DEFAULTS = { sawmillPercent: 10, quarryPercent: 10, grainFarmPercent: 10, windmillPercent: 10, cathedralPercent: 10 }

async function loadKingdom(userId, id) {
  const whereK = id
    ? and(eq(kingdoms.userId, userId), eq(kingdoms.id, id))
    : eq(kingdoms.userId, userId)
  const rows = await db.select({ id: kingdoms.id, productionSettings: kingdoms.productionSettings })
    .from(kingdoms).where(whereK).limit(1)
  return rows[0] ?? null
}

export default async function handler(req, res) {
  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const kingdomId = req.query?.id ? String(req.query.id) : null
  const cfg = await getSettings()
  const serverPayload = {
    economySpeed:       cfg.economy_speed,
    researchSpeed:      cfg.research_speed,
    fleetSpeedWar:      cfg.fleet_speed_war,
    fleetSpeedPeaceful: cfg.fleet_speed_peaceful,
    basicWood:          cfg.basic_wood,
    basicStone:         cfg.basic_stone,
  }

  if (req.method === 'GET') {
    const kingdom = await loadKingdom(userId, kingdomId)
    const stored  = (kingdom?.productionSettings ?? {})
    const percents = { ...PERCENT_DEFAULTS, ...stored }
    return res.json({ ...percents, ...serverPayload })
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {}
    const patch = {}
    for (const k of PERCENT_KEYS) {
      if (k in body) {
        const v = parseInt(body[k], 10)
        if (!isNaN(v) && v >= 0 && v <= 10) patch[k] = v
      }
    }

    const kingdom = await loadKingdom(userId, kingdomId)
    if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

    const merged = { ...(kingdom.productionSettings ?? {}), ...patch }
    await db.update(kingdoms)
      .set({ productionSettings: merged, updatedAt: new Date() })
      .where(eq(kingdoms.id, kingdom.id))

    const percents = { ...PERCENT_DEFAULTS, ...merged }
    return res.json({ ok: true, ...percents, ...serverPayload })
  }

  res.status(405).end()
}
