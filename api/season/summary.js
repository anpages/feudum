/**
 * GET /api/season/summary — ended-season overview.
 * Returns top players (live from DB) + winner info.
 * Only meaningful when season_state === 'ended'.
 */
import { eq, ne } from 'drizzle-orm'
import { db, kingdoms, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { getSettings } from '../lib/settings.js'
import { calcPointsBreakdown } from '../lib/points.js'
import { getBuildingMaps, getResearchMaps } from '../lib/db-helpers.js'
import { EMPTY_RESEARCH } from '../lib/npc-engine.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const cfg = await getSettings()

  if (cfg.season_state !== 'ended') {
    return res.json({ summary: null })
  }

  const seasonNumber = parseInt(cfg.season_number ?? '0', 10)

  // Winner info
  let winner = null
  if (cfg.season_winner_user_id) {
    const [w] = await db.select({ username: users.username })
      .from(users)
      .where(eq(users.id, cfg.season_winner_user_id))
      .limit(1)
    winner = {
      id:        cfg.season_winner_user_id,
      username:  w?.username ?? 'Desconocido',
      condition: cfg.season_winner_condition ?? '',
    }
  }

  // Compute live rankings from current data (season just ended, not yet reset)
  const allKingdoms = await db
    .select({ k: kingdoms, u: users })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .where(ne(users.role, 'npc'))

  const kingdomIds = allKingdoms.map(({ k }) => k.id)
  const userIds    = [...new Set(allKingdoms.map(({ k }) => k.userId))]
  const [bMaps, resMaps] = await Promise.all([
    getBuildingMaps(kingdomIds),
    getResearchMaps(userIds),
  ])

  const ranked = allKingdoms.map(({ k, u }) => {
    const bd = calcPointsBreakdown(
      { ...k, ...(bMaps[k.id] ?? {}) },
      { ...EMPTY_RESEARCH, ...(resMaps[k.userId] ?? {}) },
    )
    return {
      userId:         k.userId,
      username:       u.username,
      points:         bd.total,
      buildingPoints: bd.buildings,
      researchPoints: bd.research,
      unitPoints:     bd.units,
      isMe:           k.userId === userId,
    }
  })

  ranked.sort((a, b) => b.points - a.points)
  ranked.forEach((e, i) => { e.rank = i + 1 })

  const topPlayers  = ranked.slice(0, 10)
  const mySnapshot  = ranked.find(r => r.isMe) ?? null

  return res.json({
    summary: {
      seasonNumber,
      seasonStart: parseInt(cfg.season_start ?? '0', 10),
      seasonEnd:   parseInt(cfg.season_end   ?? '0', 10),
      winner,
      topPlayers,
      mySnapshot,
    },
  })
}
