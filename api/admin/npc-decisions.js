import { eq } from 'drizzle-orm'
import { db, kingdoms } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { npcPersonality } from '../lib/npc-engine.js'

const FILTERS = {
  saving:   d => d.startsWith('ahorrando'),
  waiting:  d => d.startsWith('en cola'),
  building: d => d.startsWith('hito') || d.startsWith('crecimiento') || d.startsWith('energía') || d.startsWith('almacén') || d.startsWith('requisito'),
  training: d => d.startsWith('entrenando'),
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  const now    = Math.floor(Date.now() / 1000)
  const limit  = Math.min(parseInt(req.query.limit  ?? '150', 10), 500)
  const filter = req.query.filter ?? 'all'

  const rows = await db.select({
    id:           kingdoms.id,
    name:         kingdoms.name,
    realm:        kingdoms.realm,
    region:       kingdoms.region,
    slot:         kingdoms.slot,
    lastDecision: kingdoms.lastDecision,
    npcNextCheck: kingdoms.npcNextCheck,
    npcLevel:     kingdoms.npcLevel,
    isBoss:       kingdoms.isBoss,
  }).from(kingdoms).where(eq(kingdoms.isNpc, true))

  const filterFn = FILTERS[filter]

  const decisions = rows
    .filter(r => !r.isBoss)
    .map(r => ({
      id:           r.id,
      name:         r.name,
      realm:        r.realm,
      region:       r.region,
      slot:         r.slot,
      lastDecision: r.lastDecision ?? null,
      npcNextCheck: r.npcNextCheck ?? null,
      npcLevel:     r.npcLevel ?? 1,
      personality:  npcPersonality(r),
      secsUntilNext: r.npcNextCheck ? Math.max(0, r.npcNextCheck - now) : 0,
    }))
    .filter(r => !filterFn || filterFn((r.lastDecision ?? '').toLowerCase()))
    .sort((a, b) => a.secsUntilNext - b.secsUntilNext)
    .slice(0, limit)

  const totalByFilter = {
    all:      rows.filter(r => !r.isBoss).length,
    saving:   rows.filter(r => !r.isBoss && FILTERS.saving((r.lastDecision ?? '').toLowerCase())).length,
    waiting:  rows.filter(r => !r.isBoss && FILTERS.waiting((r.lastDecision ?? '').toLowerCase())).length,
    building: rows.filter(r => !r.isBoss && FILTERS.building((r.lastDecision ?? '').toLowerCase())).length,
    training: rows.filter(r => !r.isBoss && FILTERS.training((r.lastDecision ?? '').toLowerCase())).length,
  }

  return res.json({ decisions, totalByFilter, now })
}
