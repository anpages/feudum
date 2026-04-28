/**
 * GET /api/season — public endpoint returning current season info.
 */
import { eq } from 'drizzle-orm'
import { db, users } from '../_db.js'
import { getSettings } from '../lib/settings.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const cfg = await getSettings()

  const seasonNumber    = parseInt(cfg.season_number   ?? '0', 10)
  const seasonState     = cfg.season_state             ?? null
  const seasonStart     = parseInt(cfg.season_start    ?? '0', 10)
  const seasonEnd       = parseInt(cfg.season_end      ?? '0', 10)
  const winnerUserId    = cfg.season_winner_user_id || null
  const winnerCondition = cfg.season_winner_condition  ?? null

  if (!seasonNumber || !seasonState) {
    return res.json({ active: false, seasonNumber: 0, seasonState: null })
  }

  const now      = Math.floor(Date.now() / 1000)
  const timeLeft = Math.max(0, seasonEnd - now)

  // Winner info
  let winner = null
  if (winnerUserId) {
    const [winnerUser] = await db.select({ id: users.id, username: users.username })
      .from(users).where(eq(users.id, winnerUserId)).limit(1)
    winner = winnerUser ?? null
  }

  return res.json({
    active:        seasonState === 'active',
    seasonNumber,
    seasonState,
    seasonStart,
    seasonEnd,
    timeLeft,
    winner: winner ? { ...winner, condition: winnerCondition } : null,
  })
}
