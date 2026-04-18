import { eq, and } from 'drizzle-orm'
import { db, kingdoms, research, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { getSettings } from '../lib/settings.js'
import {
  windmillEnergy, cathedralEnergy,
  sawmillEnergy, quarryEnergy, grainFarmEnergy,
} from '../lib/buildings.js'

const MOBILE_UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

/**
 * Compute hourly production rates applying:
 *   - energy balance (windmill + cathedral vs sawmill + quarry + grainFarm)
 *   - mine throttle percentages (0-10 scale)
 *   - dragonlore research bonus
 *   - economy speed
 *   - collector class bonus (+25%)
 *
 * The stored kingdom.*Production values are base rates (no energy factor, no throttle).
 * Temperature is already baked into kingdom.grainProduction via applyBuildingEffect.
 */
function effectiveProduction(kingdom, res, cfg, characterClass = null) {
  const dl         = res?.dragonlore ?? 0
  const alchLv     = res?.alchemy    ?? 0
  const speed      = cfg.economy_speed ?? 1
  const classBonus = characterClass === 'collector' ? 1.25 : 1.0

  // ── Mine throttle (0-10 → 0-100%) ──────────────────────────────────────────
  const sawPct   = (kingdom.sawmillPercent    ?? 10) / 10
  const quarPct  = (kingdom.quarryPercent     ?? 10) / 10
  const grainPct = (kingdom.grainFarmPercent  ?? 10) / 10
  const windPct  = (kingdom.windmillPercent   ?? 10) / 10
  const catPct   = (kingdom.cathedralPercent  ?? 10) / 10

  // ── Energy balance ──────────────────────────────────────────────────────────
  const energyProd = windmillEnergy(kingdom.windmill ?? 0) * windPct
                   + cathedralEnergy(kingdom.cathedral ?? 0, alchLv) * catPct

  // Consumption scales with throttle (throttling a mine also reduces its energy draw)
  const energyCons = sawmillEnergy(kingdom.sawmill    ?? 0) * sawPct
                   + quarryEnergy(kingdom.quarry      ?? 0) * quarPct
                   + grainFarmEnergy(kingdom.grainFarm ?? 0) * grainPct

  const energyFactor = energyCons > 0
    ? Math.min(1, energyProd / energyCons)
    : 1.0

  // ── Effective production ────────────────────────────────────────────────────
  const wood  = cfg.basic_wood  + kingdom.woodProduction  * sawPct   * energyFactor * (1 + dl * 0.010)  * speed * classBonus
  const stone = cfg.basic_stone + kingdom.stoneProduction * quarPct  * energyFactor * (1 + dl * 0.0066) * speed * classBonus
  const grain =                   kingdom.grainProduction * grainPct * energyFactor * (1 + dl * 0.0033) * speed * classBonus

  return { wood, stone, grain, energyProd, energyCons }
}

export default async function handler(req, res) {
  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  // ── PATCH — rename kingdom ─────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { name, id: bodyId } = req.body ?? {}
    const kingdomId = bodyId ? parseInt(bodyId, 10) : null
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Nombre requerido' })
    const clean = name.trim()
    if (clean.length < 3 || clean.length > 50) return res.status(400).json({ error: 'El nombre debe tener entre 3 y 50 caracteres' })
    const whereK = kingdomId
      ? and(eq(kingdoms.userId, userId), eq(kingdoms.id, kingdomId))
      : eq(kingdoms.userId, userId)
    const [updated] = await db.update(kingdoms)
      .set({ name: clean, updatedAt: new Date() })
      .where(whereK)
      .returning()
    if (!updated) return res.status(404).json({ error: 'Reino no encontrado' })
    return res.json({ ok: true, name: updated.name })
  }

  // ── DELETE — abandon colony ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const targetId = req.query.id ? parseInt(req.query.id, 10) : null
    if (!targetId) return res.status(400).json({ error: 'id requerido' })
    const allKingdoms = await db.select({ id: kingdoms.id })
      .from(kingdoms).where(eq(kingdoms.userId, userId))
    if (allKingdoms.length <= 1) return res.status(400).json({ error: 'No puedes abandonar tu único reino' })
    const target = allKingdoms.find(k => k.id === targetId)
    if (!target) return res.status(404).json({ error: 'Reino no encontrado' })
    await db.delete(kingdoms).where(and(eq(kingdoms.id, targetId), eq(kingdoms.userId, userId)))
    return res.json({ ok: true })
  }

  if (req.method !== 'GET') return res.status(405).end()

  const requestedId = req.query.id ? parseInt(req.query.id, 10) : null
  const whereClause = requestedId
    ? and(eq(kingdoms.userId, userId), eq(kingdoms.id, requestedId))
    : eq(kingdoms.userId, userId)

  const [[kingdom], [researchRow], [userRow], cfg] = await Promise.all([
    db.select().from(kingdoms).where(whereClause).limit(1),
    db.select().from(research).where(eq(research.userId, userId)).limit(1),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, userId)).limit(1),
    getSettings(),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  const eff            = effectiveProduction(kingdom, researchRow, cfg, userRow?.characterClass)
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

    return res.json({
      ...updated,
      woodProduction: eff.wood, stoneProduction: eff.stone, grainProduction: eff.grain,
      energyProduced: eff.energyProd, energyConsumed: eff.energyCons,
    })
  }

  if (populationUsed !== kingdom.populationUsed) {
    await db.update(kingdoms)
      .set({ populationUsed, updatedAt: new Date() })
      .where(eq(kingdoms.id, kingdom.id))
  }

  return res.json({
    ...kingdom,
    populationUsed,
    woodProduction: eff.wood, stoneProduction: eff.stone, grainProduction: eff.grain,
    energyProduced: eff.energyProd, energyConsumed: eff.energyCons,
  })
}
