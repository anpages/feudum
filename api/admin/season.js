/**
 * Season management — admin only.
 * GET                              → current season info
 * POST { action: "start_season" } → emergency manual start (cron handles normal flow)
 * POST { action: "end_season" }   → force-end current season
 */
import { eq } from 'drizzle-orm'
import { db, kingdoms, npcState } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { getSettings, setSetting } from '../lib/settings.js'
import { startNewSeason } from '../lib/season.js'

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  // ── GET — season status ───────────────────────────────────────────────────
  if (req.method === 'GET') {
    const cfg = await getSettings()
    const [bossKingdom] = await db.select({
      id: kingdoms.id, name: kingdoms.name,
      realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
    }).from(kingdoms)
      .innerJoin(npcState, eq(kingdoms.userId, npcState.userId))
      .where(eq(npcState.isBoss, true))
      .limit(1)

    return res.json({
      seasonNumber:          cfg.season_number           ?? null,
      seasonState:           cfg.season_state            ?? null,
      seasonStart:           cfg.season_start            ?? null,
      seasonEnd:             cfg.season_end              ?? null,
      seasonBossSlug:        cfg.season_boss_slug        ?? null,
      seasonWinnerUserId:    cfg.season_winner_user_id   ?? null,
      seasonWinnerCondition: cfg.season_winner_condition ?? null,
      boss: bossKingdom ?? null,
    })
  }

  if (req.method !== 'POST') return res.status(405).end()

  const { action } = req.body ?? {}

  // ── start_season — emergency fallback (cron normally handles this) ─────────
  if (action === 'start_season') {
    const cfg  = await getSettings()
    if (cfg.season_state === 'active') {
      return res.status(400).json({ error: 'already_active' })
    }
    const nextNumber = (parseInt(cfg.season_number ?? '0', 10) || 0) + 1
    const result = await startNewSeason(nextNumber, cfg.economy_speed)
    return res.json({ ok: true, seasonNumber: nextNumber, ...result })
  }

  // ── recalculate_end — recompute season_end from season_start + 360/speed ───
  if (action === 'recalculate_end') {
    const cfg   = await getSettings()
    const start = parseInt(cfg.season_start ?? '0', 10)
    const speed = parseFloat(cfg.economy_speed ?? '1')
    if (!start) return res.status(400).json({ error: 'no season_start' })
    const newEnd = start + Math.round((360 / speed) * 86400)
    await setSetting('season_end', String(newEnd))
    return res.json({ ok: true, newEnd, newEndDate: new Date(newEnd * 1000).toISOString() })
  }

  // ── end_season — force-end ────────────────────────────────────────────────
  if (action === 'end_season') {
    const winnerUserId = req.body.winnerUserId ? String(req.body.winnerUserId) : null
    const condition    = req.body.condition ?? 'admin_forced'
    await Promise.all([
      setSetting('season_state',              'ended'),
      setSetting('season_end',                String(Math.floor(Date.now() / 1000))),
      setSetting('season_winner_user_id',     winnerUserId ?? ''),
      setSetting('season_winner_condition',   condition),
    ])
    return res.json({ ok: true })
  }

  return res.status(400).json({ error: 'unknown_action' })
}
