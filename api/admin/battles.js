import { desc, eq, and, gte, or } from 'drizzle-orm'
import { db, battleLog } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })
  if (req.method !== 'GET') return res.status(405).end()

  const page  = Math.max(1, parseInt(req.query.page  ?? '1',  10))
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '25', 10)))
  const type  = req.query.type ?? 'all'  // all | npc_vs_npc | npc_vs_player | player_vs_npc | player_vs_player
  const offset = (page - 1) * limit

  let whereClause
  if (type === 'npc_vs_npc') {
    whereClause = and(eq(battleLog.attackerIsNpc, true), eq(battleLog.defenderIsNpc, true))
  } else if (type === 'npc_vs_player') {
    whereClause = and(eq(battleLog.attackerIsNpc, true), eq(battleLog.defenderIsNpc, false))
  } else if (type === 'player_vs_npc') {
    whereClause = and(eq(battleLog.attackerIsNpc, false), eq(battleLog.defenderIsNpc, true))
  } else if (type === 'player_vs_player') {
    whereClause = and(eq(battleLog.attackerIsNpc, false), eq(battleLog.defenderIsNpc, false))
  }

  const rows = await db.select().from(battleLog)
    .where(whereClause)
    .orderBy(desc(battleLog.createdAt))
    .limit(limit)
    .offset(offset)

  // Aggregate metrics (last 24h)
  const since = new Date(Date.now() - 24 * 3600 * 1000)
  const recent = await db.select().from(battleLog)
    .where(gte(battleLog.createdAt, since))

  const metrics = {
    total24h:         recent.length,
    npcVsNpc24h:      recent.filter(r => r.attackerIsNpc && r.defenderIsNpc).length,
    npcVsPlayer24h:   recent.filter(r => r.attackerIsNpc && !r.defenderIsNpc).length,
    playerVsNpc24h:   recent.filter(r => !r.attackerIsNpc && r.defenderIsNpc).length,
    playerVsPlayer24h: recent.filter(r => !r.attackerIsNpc && !r.defenderIsNpc).length,
    totalLoot24h: {
      wood:  recent.reduce((s, r) => s + (r.lootWood  ?? 0), 0),
      stone: recent.reduce((s, r) => s + (r.lootStone ?? 0), 0),
      grain: recent.reduce((s, r) => s + (r.lootGrain ?? 0), 0),
    },
  }

  return res.json({ battles: rows, metrics, page, limit })
}
