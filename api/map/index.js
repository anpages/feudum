import { eq, and, inArray } from 'drizzle-orm'
import { db, kingdoms, users, debrisFields, npcState } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { calcPoints } from '../lib/points.js'
import { getBuildingMap, getResearchMap } from '../lib/db-helpers.js'
import { UNIVERSE } from '../lib/config.js'

const MAX_REALM  = UNIVERSE.maxRealm
const MAX_REGION = UNIVERSE.maxRegion
const MAX_SLOT   = UNIVERSE.maxSlot

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  // Parse & clamp params
  let realm  = Math.max(1, Math.min(MAX_REALM,  parseInt(req.query.realm  ?? '1', 10) || 1))
  let region = Math.max(1, Math.min(MAX_REGION, parseInt(req.query.region ?? '1', 10) || 1))

  // Get player's own kingdom for highlighting + debris for this region
  const [[myKingdom], debrisRows] = await Promise.all([
    db.select({ id: kingdoms.id, realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot })
      .from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    db.select().from(debrisFields)
      .where(and(eq(debrisFields.realm, realm), eq(debrisFields.region, region))),
  ])
  const debrisBySlot = Object.fromEntries(debrisRows.map(d => [d.slot, { wood: d.wood, stone: d.stone }]))

  // Get all kingdoms in this realm+region with user and npc_state data
  const realKingdoms = await db
    .select({ k: kingdoms, u: users, ns: npcState })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .leftJoin(npcState, eq(kingdoms.userId, npcState.userId))
    .where(and(
      eq(kingdoms.realm,  realm),
      eq(kingdoms.region, region),
    ))

  // Fetch research for point calculation (all kingdoms)
  const researchMaps = {}
  for (const { k } of realKingdoms) {
    researchMaps[k.userId] = await getResearchMap(k.userId)
  }

  // Build slots 1-15
  const realBySlot = Object.fromEntries(realKingdoms.map(r => [r.k.slot, r]))

  const slots = Array.from({ length: MAX_SLOT }, (_, i) => {
    const slot = i + 1
    const debris = debrisBySlot[slot] ?? null

    if (realBySlot[slot]) {
      const { k, u, ns } = realBySlot[slot]
      const isNpc = u.role === 'npc'
      const points = calcPoints(k, researchMaps[k.userId] ?? {})
      return {
        slot,
        kingdomId: k.id,
        name:      k.name,
        username:  isNpc ? null : u.username,
        isPlayer:  k.userId === userId,
        isNpc,
        npcLevel:  isNpc ? (ns?.npcLevel ?? 1) : undefined,
        isBoss:    isNpc ? (ns?.isBoss ?? false) : undefined,
        points,
        isEmpty:   false,
        debris,
      }
    }

    return { slot, kingdomId: null, name: null, username: null, isPlayer: false, isNpc: false, points: 0, isEmpty: true, debris }
  })

  return res.json({
    realm,
    region,
    maxRealm:  MAX_REALM,
    maxRegion: MAX_REGION,
    myPosition: myKingdom
      ? { realm: myKingdom.realm, region: myKingdom.region, slot: myKingdom.slot }
      : null,
    slots,
  })
}
