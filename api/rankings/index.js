import { eq, ne } from 'drizzle-orm'
import { db, kingdoms, users, npcState } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { calcPointsBreakdown } from '../lib/points.js'
import { getBuildingMap, getResearchMap } from '../lib/db-helpers.js'
import { EMPTY_RESEARCH } from '../lib/npc-engine.js'

const VALID_CATEGORIES = ['total', 'buildings', 'research', 'units', 'economy']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const category   = VALID_CATEGORIES.includes(req.query.category) ? req.query.category : 'total'
  const playerType = req.query.type === 'npcs' ? 'npcs' : 'players'
  const showNpcs   = playerType === 'npcs'

  // Fetch all kingdoms joined with users and npc_state
  const allKingdomRows = await db
    .select({ k: kingdoms, u: users, ns: npcState })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .leftJoin(npcState, eq(kingdoms.userId, npcState.userId))
    .where(showNpcs ? eq(users.role, 'npc') : ne(users.role, 'npc'))

  const ranked = await Promise.all(allKingdomRows.map(async ({ k, u, ns }) => {
    // Enrich kingdom with building map
    const bMap = await getBuildingMap(k.id)
    const enrichedKingdom = { ...k, ...bMap }

    // Get research map
    const resMap = await getResearchMap(k.userId)
    // For NPCs with no research rows, use EMPTY_RESEARCH fallback
    const resObj = { ...EMPTY_RESEARCH, ...resMap }

    const breakdown = calcPointsBreakdown(enrichedKingdom, resObj)

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
  }))

  ranked.sort((a, b) => b.points - a.points)
  ranked.forEach((entry, i) => { entry.rank = i + 1 })

  return res.json({ rankings: ranked, category, playerType })
}
