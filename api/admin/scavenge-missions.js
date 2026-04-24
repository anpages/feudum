import { desc, eq, and, gte, or, inArray } from 'drizzle-orm'
import { db, armyMissions, kingdoms, users, debrisFields } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })
  if (req.method !== 'GET') return res.status(405).end()

  const now     = Math.floor(Date.now() / 1000)
  const since7d = now - 7 * 86400
  const since24 = now - 86400

  const [active, recent, debris] = await Promise.all([
    db.select({
      id: armyMissions.id, userId: armyMissions.userId, state: armyMissions.state,
      startRealm: armyMissions.startRealm, startRegion: armyMissions.startRegion, startSlot: armyMissions.startSlot,
      targetRealm: armyMissions.targetRealm, targetRegion: armyMissions.targetRegion, targetSlot: armyMissions.targetSlot,
      departureTime: armyMissions.departureTime, arrivalTime: armyMissions.arrivalTime,
      returnTime: armyMissions.returnTime, units: armyMissions.units,
      woodLoad: armyMissions.woodLoad, stoneLoad: armyMissions.stoneLoad,
    }).from(armyMissions)
      .where(and(
        eq(armyMissions.missionType, 'scavenge'),
        or(eq(armyMissions.state, 'active'), eq(armyMissions.state, 'returning')),
      ))
      .orderBy(desc(armyMissions.departureTime))
      .limit(100),

    db.select({
      id: armyMissions.id, userId: armyMissions.userId, state: armyMissions.state,
      startRealm: armyMissions.startRealm, startRegion: armyMissions.startRegion, startSlot: armyMissions.startSlot,
      targetRealm: armyMissions.targetRealm, targetRegion: armyMissions.targetRegion, targetSlot: armyMissions.targetSlot,
      departureTime: armyMissions.departureTime, arrivalTime: armyMissions.arrivalTime,
      returnTime: armyMissions.returnTime, units: armyMissions.units,
      woodLoad: armyMissions.woodLoad, stoneLoad: armyMissions.stoneLoad,
    }).from(armyMissions)
      .where(and(
        eq(armyMissions.missionType, 'scavenge'),
        eq(armyMissions.state, 'completed'),
        gte(armyMissions.departureTime, since7d),
      ))
      .orderBy(desc(armyMissions.departureTime))
      .limit(200),

    db.select({
      realm: debrisFields.realm, region: debrisFields.region, slot: debrisFields.slot,
      wood: debrisFields.wood, stone: debrisFields.stone,
    }).from(debrisFields),
  ])

  const all = [...active, ...recent]
  const userIds = [...new Set(all.map(m => m.userId))]
  const kingdomRows = userIds.length
    ? await db.select({
        userId: kingdoms.userId, name: kingdoms.name,
        realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
        userRole: users.role,
      }).from(kingdoms).innerJoin(users, eq(kingdoms.userId, users.id))
        .where(inArray(kingdoms.userId, userIds))
    : []

  const byCoord = {}
  for (const k of kingdomRows) byCoord[`${k.realm}:${k.region}:${k.slot}`] = { name: k.name, isNpc: k.userRole === 'npc' }

  const debrisByCoord = {}
  let totalDebris = 0
  for (const d of debris) {
    debrisByCoord[`${d.realm}:${d.region}:${d.slot}`] = { wood: d.wood, stone: d.stone }
    totalDebris += (d.wood ?? 0) + (d.stone ?? 0)
  }

  const enrich = m => {
    const k = byCoord[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    const targetDebris = debrisByCoord[`${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`]
    return {
      ...m,
      attackerName: k?.name ?? '?',
      attackerIsNpc: k?.isNpc ?? false,
      targetCoord: `${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`,
      debrisNow: targetDebris ?? null,
      woodLoad:  m.woodLoad  ?? 0,
      stoneLoad: m.stoneLoad ?? 0,
    }
  }

  const enrichedActive = active.map(enrich)
  const enrichedRecent = recent.map(enrich)
  const recent24 = enrichedRecent.filter(m => m.departureTime >= since24)

  const metrics = {
    activeNow:      enrichedActive.length,
    sent24h:        recent24.length + enrichedActive.filter(m => m.departureTime >= since24).length,
    collected24hWood:  recent24.reduce((s, m) => s + (m.woodLoad  ?? 0), 0),
    collected24hStone: recent24.reduce((s, m) => s + (m.stoneLoad ?? 0), 0),
    totalDebrisAvailable: Math.round(totalDebris),
    activeDebrisFields: debris.filter(d => (d.wood + d.stone) > 0).length,
  }

  return res.json({ active: enrichedActive, recent: enrichedRecent, metrics, now })
}
