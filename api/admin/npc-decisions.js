import { eq } from 'drizzle-orm'
import { db, kingdoms, users, npcState } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { npcPersonality } from '../lib/npc-engine.js'

const FILTERS = {
  saving:      d => d.startsWith('ahorrando'),
  building:    d => d.startsWith('hito') || d.startsWith('crecimiento') || d.startsWith('energía') || d.startsWith('almacén') || d.startsWith('requisito') || (d.startsWith('ocupado') && d.includes('construyendo')),
  training:    d => d.startsWith('entrenando') || (d.startsWith('ocupado') && d.includes('entrenando')),
  researching: d => d.startsWith('investigando') || d.startsWith('investigación') || d.startsWith('investigado'),
  // research_activity: investigando activamente + ahorrando para investigar (bloqueados por recursos)
  research_activity: d => d.startsWith('investigando') || d.startsWith('investigación') || d.startsWith('investigado') || (d.startsWith('ahorrando') && d.includes('investigar')),
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  const now    = Math.floor(Date.now() / 1000)
  const limit  = Math.min(parseInt(req.query.limit  ?? '150', 10), 500)
  const filter = req.query.filter ?? 'all'

  const rows = await db.select({
    id:                  kingdoms.id,
    name:                kingdoms.name,
    realm:               kingdoms.realm,
    region:              kingdoms.region,
    slot:                kingdoms.slot,
    lastDecision:        npcState.lastDecision,
    nextCheck:           npcState.nextCheck,
    npcLevel:            npcState.npcLevel,
    currentTask:         npcState.currentTask,
    currentResearch:     npcState.currentResearch,
    researchAvailableAt: npcState.researchAvailableAt,
    buildAvailableAt:    npcState.buildAvailableAt,
  }).from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .innerJoin(npcState, eq(kingdoms.userId, npcState.userId))
    .where(eq(users.role, 'npc'))

  const filterFn = FILTERS[filter]

  const decisions = rows
    .map(r => ({
      id:                  r.id,
      name:                r.name,
      realm:               r.realm,
      region:              r.region,
      slot:                r.slot,
      lastDecision:        r.lastDecision ?? null,
      npcNextCheck:        r.nextCheck ?? null,
      npcLevel:            r.npcLevel ?? 1,
      personality:         npcPersonality(r),
      secsUntilNext:       r.nextCheck ? Math.max(0, r.nextCheck - now) : 0,
      currentTask:         r.currentTask ?? null,
      currentResearch:     r.currentResearch ?? null,
      researchAvailableAt: r.researchAvailableAt ?? null,
      buildAvailableAt:    r.buildAvailableAt ?? null,
    }))
    .filter(r => !filterFn || filterFn((r.lastDecision ?? '').toLowerCase()))
    .sort((a, b) => a.secsUntilNext - b.secsUntilNext)
    .slice(0, limit)

  const totalByFilter = {
    all:               rows.length,
    saving:            rows.filter(r => FILTERS.saving((r.lastDecision ?? '').toLowerCase())).length,
    building:          rows.filter(r => FILTERS.building((r.lastDecision ?? '').toLowerCase())).length,
    training:          rows.filter(r => FILTERS.training((r.lastDecision ?? '').toLowerCase())).length,
    researching:       rows.filter(r => FILTERS.researching((r.lastDecision ?? '').toLowerCase())).length,
    research_activity: rows.filter(r => FILTERS.research_activity((r.lastDecision ?? '').toLowerCase())).length,
  }

  return res.json({ decisions, totalByFilter, now })
}
