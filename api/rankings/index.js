import { eq } from 'drizzle-orm'
import { db, kingdoms, users, research } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { calcPointsBreakdown } from '../lib/points.js'
import { npcResearch as npcResearchLevels } from '../lib/npc-engine.js'

const VALID_CATEGORIES = ['total', 'buildings', 'research', 'units', 'economy']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const category   = VALID_CATEGORIES.includes(req.query.category) ? req.query.category : 'total'
  const playerType = req.query.type === 'npcs' ? 'npcs' : 'players'
  const showNpcs   = playerType === 'npcs'

  const [allKingdoms, allResearch] = await Promise.all([
    db.select().from(kingdoms)
      .innerJoin(users, eq(kingdoms.userId, users.id))
      .where(eq(kingdoms.isNpc, showNpcs)),
    db.select().from(research),
  ])

  const researchByUser = Object.fromEntries(allResearch.map(r => [r.userId, r]))

  const ranked = allKingdoms
    .map(({ kingdoms: k, users: u }) => {
      const res = k.isNpc ? npcResearchLevels(k) : (researchByUser[k.userId] ?? {})
      const breakdown = calcPointsBreakdown(k, res)
      return {
        kingdomId: k.id,
        name:      k.name,
        username:  u.username,
        realm:     k.realm,
        region:    k.region,
        slot:      k.slot,
        isNpc:     k.isNpc,
        isBoss:    k.isBoss,
        npcLevel:  k.npcLevel,
        points:    breakdown[category],
        breakdown,
        isMe:      k.userId === userId,
      }
    })
    .sort((a, b) => b.points - a.points)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))

  return res.json({ rankings: ranked, category, playerType })
}
