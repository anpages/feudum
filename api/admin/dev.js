import { eq, and } from 'drizzle-orm'
import { db, users, kingdoms, research, buildingQueue, researchQueue, unitQueue } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { applyBuildingEffect } from '../lib/buildings.js'

const BUILDING_KEYS = [
  'sawmill','quarry','grainFarm','windmill','cathedral','workshop','engineersGuild',
  'barracks','granary','stonehouse','silo','academy','alchemistTower','ambassadorHall','armoury',
]
const RESEARCH_KEYS = [
  'swordsmanship','armoury','fortification','horsemanship','cartography','tradeRoutes',
  'alchemy','pyromancy','runemastery','mysticism','dragonlore',
  'spycraft','logistics','exploration','diplomaticNetwork','divineBlessing',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  const { action, kingdomId, userId } = req.body

  // ── Set resources ─────────────────────────────────────────────────────────
  if (action === 'set_resources') {
    const { wood, stone, grain } = req.body
    const patch = {}
    if (wood  != null) patch.wood  = Math.max(0, parseFloat(wood))
    if (stone != null) patch.stone = Math.max(0, parseFloat(stone))
    if (grain != null) patch.grain = Math.max(0, parseFloat(grain))
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'no_fields' })
    await db.update(kingdoms).set(patch).where(eq(kingdoms.id, kingdomId))
    return res.json({ ok: true })
  }

  // ── Set building level ────────────────────────────────────────────────────
  if (action === 'set_building') {
    const { building, level } = req.body
    if (!BUILDING_KEYS.includes(building)) return res.status(400).json({ error: 'invalid_building' })
    const lv = Math.max(0, parseInt(level, 10))
    const [kingdom] = await db.select().from(kingdoms).where(eq(kingdoms.id, kingdomId)).limit(1)
    if (!kingdom) return res.status(404).json({ error: 'kingdom_not_found' })
    const patch = applyBuildingEffect(building, lv, kingdom)
    await db.update(kingdoms).set(patch).where(eq(kingdoms.id, kingdomId))
    return res.json({ ok: true })
  }

  // ── Set research level ────────────────────────────────────────────────────
  if (action === 'set_research') {
    const { tech, level } = req.body
    if (!RESEARCH_KEYS.includes(tech)) return res.status(400).json({ error: 'invalid_research' })
    const lv = Math.max(0, parseInt(level, 10))
    await db.update(research).set({ [tech]: lv, updatedAt: new Date() }).where(eq(research.userId, userId))
    return res.json({ ok: true })
  }

  // ── Fast-forward all queues for a kingdom ────────────────────────────────
  if (action === 'fast_forward') {
    const past = Math.floor(Date.now() / 1000) - 1
    await Promise.all([
      db.update(buildingQueue).set({ finishesAt: past }).where(eq(buildingQueue.kingdomId, kingdomId)),
      db.update(unitQueue).set({ finishesAt: past }).where(eq(unitQueue.kingdomId, kingdomId)),
    ])
    if (userId) {
      await db.update(researchQueue).set({ finishesAt: past }).where(eq(researchQueue.userId, userId))
    }
    return res.json({ ok: true })
  }

  res.status(400).json({ error: 'unknown_action' })
}
