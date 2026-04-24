import { desc, eq, and, gte, or, inArray } from 'drizzle-orm'
import { db, armyMissions, kingdoms, users } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })
  if (req.method !== 'GET') return res.status(405).end()

  const now     = Math.floor(Date.now() / 1000)
  const since7d = now - 7 * 86400
  const since24 = now - 86400

  const [active, recent] = await Promise.all([
    db.select({
      id: armyMissions.id, userId: armyMissions.userId, state: armyMissions.state,
      startRealm: armyMissions.startRealm, startRegion: armyMissions.startRegion, startSlot: armyMissions.startSlot,
      targetRealm: armyMissions.targetRealm, targetRegion: armyMissions.targetRegion, targetSlot: armyMissions.targetSlot,
      departureTime: armyMissions.departureTime, arrivalTime: armyMissions.arrivalTime,
      returnTime: armyMissions.returnTime, units: armyMissions.units,
    }).from(armyMissions)
      .where(and(
        eq(armyMissions.missionType, 'spy'),
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
      result: armyMissions.result,
    }).from(armyMissions)
      .where(and(
        eq(armyMissions.missionType, 'spy'),
        eq(armyMissions.state, 'completed'),
        gte(armyMissions.departureTime, since7d),
      ))
      .orderBy(desc(armyMissions.departureTime))
      .limit(200),
  ])

  // Enrich with kingdom names by coord
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

  // Separate target kingdom lookup (any kingdom, not just attacker's)
  const targetCoords = [...new Set(all.map(m => `${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`))]
  const targetRows = targetCoords.length
    ? await db.select({
        name: kingdoms.name, realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
        userRole: users.role,
      }).from(kingdoms).innerJoin(users, eq(kingdoms.userId, users.id))
    : []
  const targetByCoord = {}
  for (const k of targetRows) targetByCoord[`${k.realm}:${k.region}:${k.slot}`] = { name: k.name, isNpc: k.userRole === 'npc' }

  const enrich = m => {
    const attacker = byCoord[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    const target   = targetByCoord[`${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`]
    const result   = m.result ? JSON.parse(m.result) : null
    return {
      ...m,
      attackerName: attacker?.name ?? '?',
      attackerIsNpc: attacker?.isNpc ?? false,
      targetName:   target?.name ?? `(${m.targetRealm}:${m.targetRegion}:${m.targetSlot})`,
      targetIsNpc:  target?.isNpc ?? true,
      scouts: m.units?.scout ?? 0,
      detected: result?.detected ?? false,
      resources: result?.resources ?? null,
      hasUnits: result?.units != null,
      hasDefense: result?.defense != null,
      result: undefined,  // strip raw JSON
    }
  }

  const enrichedActive = active.map(enrich)
  const enrichedRecent = recent.map(enrich)
  const recent24 = enrichedRecent.filter(m => m.departureTime >= since24)

  const metrics = {
    activeNow:      enrichedActive.length,
    sent24h:        recent24.length + enrichedActive.filter(m => m.departureTime >= since24).length,
    detected24h:    recent24.filter(m => m.detected).length,
    withResources:  recent24.filter(m => m.resources != null).length,
  }

  return res.json({ active: enrichedActive, recent: enrichedRecent, metrics, now })
}
