import { eq } from 'drizzle-orm'
import { db, kingdoms, users, research } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { calcPoints } from '../lib/points.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const [allKingdoms, allResearch] = await Promise.all([
    db.select({
      id:       kingdoms.id,
      userId:   kingdoms.userId,
      name:     kingdoms.name,
      realm:    kingdoms.realm,
      region:   kingdoms.region,
      slot:     kingdoms.slot,
      // buildings
      sawmill:        kingdoms.sawmill,
      quarry:         kingdoms.quarry,
      grainFarm:      kingdoms.grainFarm,
      windmill:       kingdoms.windmill,
      workshop:       kingdoms.workshop,
      engineersGuild: kingdoms.engineersGuild,
      barracks:       kingdoms.barracks,
      academy:        kingdoms.academy,
      // units
      squire:       kingdoms.squire,
      knight:       kingdoms.knight,
      paladin:      kingdoms.paladin,
      warlord:      kingdoms.warlord,
      grandKnight:  kingdoms.grandKnight,
      siegeMaster:  kingdoms.siegeMaster,
      warMachine:   kingdoms.warMachine,
      dragonKnight: kingdoms.dragonKnight,
      merchant:     kingdoms.merchant,
      caravan:      kingdoms.caravan,
      colonist:     kingdoms.colonist,
      scavenger:    kingdoms.scavenger,
      scout:        kingdoms.scout,
      // defenses
      archer:       kingdoms.archer,
      crossbowman:  kingdoms.crossbowman,
      ballista:     kingdoms.ballista,
      trebuchet:    kingdoms.trebuchet,
      mageTower:    kingdoms.mageTower,
      dragonCannon: kingdoms.dragonCannon,
      palisade:     kingdoms.palisade,
      castleWall:   kingdoms.castleWall,
      // owner
      username: users.username,
    })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id)),
    db.select().from(research),
  ])

  const researchByUser = Object.fromEntries(allResearch.map(r => [r.userId, r]))

  const ranked = allKingdoms
    .map(k => ({
      kingdomId: k.id,
      name:      k.name,
      username:  k.username,
      realm:     k.realm,
      region:    k.region,
      slot:      k.slot,
      points:    calcPoints(k, researchByUser[k.userId] ?? {}),
      isMe:      k.userId === userId,
    }))
    .sort((a, b) => b.points - a.points)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))

  return res.json({ rankings: ranked })
}
