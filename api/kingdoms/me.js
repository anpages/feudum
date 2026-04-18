import { eq, and } from 'drizzle-orm'
import { db, kingdoms, research, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { getSettings } from '../lib/settings.js'
import { terrainModifiers } from '../lib/terrain.js'

const MOBILE_UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

// dragonlore: +1% wood, +0.66% stone, +0.33% grain per level
// terrain: multiplier per resource based on kingdom terrain type
// collector class: +25% all resource production
function effectiveProduction(kingdom, res, cfg, characterClass = null) {
  const dl          = res?.dragonlore ?? 0
  const speed       = cfg.economy_speed ?? 1
  const t           = terrainModifiers(kingdom.terrain)
  const classBonus  = characterClass === 'collector' ? 1.25 : 1.0
  return {
    wood:  cfg.basic_wood  + kingdom.woodProduction  * t.wood  * (1 + dl * 0.010)  * speed * classBonus,
    stone: cfg.basic_stone + kingdom.stoneProduction * t.stone * (1 + dl * 0.0066) * speed * classBonus,
    grain:                   kingdom.grainProduction * t.grain * (1 + dl * 0.0033) * speed * classBonus,
  }
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
    // Ensure user owns it and has more than one kingdom
    const allKingdoms = await db.select({ id: kingdoms.id })
      .from(kingdoms).where(eq(kingdoms.userId, userId))
    if (allKingdoms.length <= 1) return res.status(400).json({ error: 'No puedes abandonar tu único reino' })
    const target = allKingdoms.find(k => k.id === targetId)
    if (!target) return res.status(404).json({ error: 'Reino no encontrado' })
    await db.delete(kingdoms).where(and(eq(kingdoms.id, targetId), eq(kingdoms.userId, userId)))
    return res.json({ ok: true })
  }

  if (req.method !== 'GET') return res.status(405).end()

  // Optional ?id= to select a specific kingdom (colony management)
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

    return res.json({ ...updated, woodProduction: eff.wood, stoneProduction: eff.stone, grainProduction: eff.grain })
  }

  if (populationUsed !== kingdom.populationUsed) {
    await db.update(kingdoms)
      .set({ populationUsed, updatedAt: new Date() })
      .where(eq(kingdoms.id, kingdom.id))
  }

  return res.json({ ...kingdom, populationUsed, woodProduction: eff.wood, stoneProduction: eff.stone, grainProduction: eff.grain })
}
