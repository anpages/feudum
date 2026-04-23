import { db, kingdoms, users, npcState } from '../_db.js'
import { eq } from 'drizzle-orm'
import { getSessionUserId } from '../lib/handler.js'
import { calcPointsBreakdown } from '../lib/points.js'
import { getBuildingMaps, getResearchMaps } from '../lib/db-helpers.js'
import { EMPTY_RESEARCH } from '../lib/npc-engine.js'

const VALID_CATEGORIES = ['total', 'buildings', 'research', 'units', 'economy']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const category = VALID_CATEGORIES.includes(req.query.category) ? req.query.category : 'total'

  // All kingdoms — players and NPCs together
  const allKingdomRows = await db
    .select({ k: kingdoms, u: users, ns: npcState })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .leftJoin(npcState, eq(kingdoms.userId, npcState.userId))

  const kingdomIds = allKingdomRows.map(({ k }) => k.id)
  const userIds    = [...new Set(allKingdomRows.map(({ k }) => k.userId))]
  const [bMaps, resMaps] = await Promise.all([
    getBuildingMaps(kingdomIds),
    getResearchMaps(userIds),
  ])

  const ranked = allKingdomRows.map(({ k, u, ns }) => {
    const breakdown = calcPointsBreakdown(
      { ...k, ...(bMaps[k.id] ?? {}) },
      { ...EMPTY_RESEARCH, ...(resMaps[k.userId] ?? {}) },
    )
    return {
      kingdomId: k.id,
      name:      k.name,
      username:  u.username,
      realm:     k.realm,
      region:    k.region,
      slot:      k.slot,
      isNpc:     u.role === 'npc',
      isBoss:    ns?.isBoss   ?? false,
      npcLevel:  ns?.npcLevel ?? 1,
      points:    breakdown[category],
      breakdown,
      isMe:      k.userId === userId,
    }
  })

  ranked.sort((a, b) => b.points - a.points)
  ranked.forEach((entry, i) => { entry.rank = i + 1 })

  return res.json({ rankings: ranked, category })
}
