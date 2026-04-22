import { desc, eq, and, gte, or, ne } from 'drizzle-orm'
import { db, armyMissions, kingdoms, users } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'

function depletionFactor(count) {
  return Math.max(0.3, 1 - Math.max(0, count - 3) * 0.10)
}

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })
  if (req.method !== 'GET') return res.status(405).end()

  const now      = Math.floor(Date.now() / 1000)
  const since24  = now - 86400
  const since7d  = now - 7 * 86400

  // Active + exploring + returning expeditions
  const active = await db.select({
    id:           armyMissions.id,
    userId:       armyMissions.userId,
    state:        armyMissions.state,
    startRealm:   armyMissions.startRealm,
    startRegion:  armyMissions.startRegion,
    startSlot:    armyMissions.startSlot,
    targetRealm:  armyMissions.targetRealm,
    targetRegion: armyMissions.targetRegion,
    targetSlot:   armyMissions.targetSlot,
    departureTime: armyMissions.departureTime,
    arrivalTime:  armyMissions.arrivalTime,
    holdingTime:  armyMissions.holdingTime,
    returnTime:   armyMissions.returnTime,
    woodLoad:     armyMissions.woodLoad,
    stoneLoad:    armyMissions.stoneLoad,
    grainLoad:    armyMissions.grainLoad,
    result:       armyMissions.result,
  }).from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'expedition'),
      or(
        eq(armyMissions.state, 'active'),
        eq(armyMissions.state, 'exploring'),
        eq(armyMissions.state, 'returning'),
      ),
    ))
    .orderBy(desc(armyMissions.departureTime))
    .limit(100)

  // Recent completed (last 7 days)
  const recent = await db.select({
    id:           armyMissions.id,
    userId:       armyMissions.userId,
    state:        armyMissions.state,
    startRealm:   armyMissions.startRealm,
    startRegion:  armyMissions.startRegion,
    startSlot:    armyMissions.startSlot,
    targetRealm:  armyMissions.targetRealm,
    targetRegion: armyMissions.targetRegion,
    targetSlot:   armyMissions.targetSlot,
    departureTime: armyMissions.departureTime,
    arrivalTime:  armyMissions.arrivalTime,
    returnTime:   armyMissions.returnTime,
    holdingTime:  armyMissions.holdingTime,
    woodLoad:     armyMissions.woodLoad,
    stoneLoad:    armyMissions.stoneLoad,
    grainLoad:    armyMissions.grainLoad,
    result:       armyMissions.result,
  }).from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'expedition'),
      eq(armyMissions.state, 'completed'),
      gte(armyMissions.departureTime, since7d),
    ))
    .orderBy(desc(armyMissions.departureTime))
    .limit(100)

  // Depletion map: all expeditions dispatched in last 24h
  const all24h = await db.select({
    targetRealm:  armyMissions.targetRealm,
    targetRegion: armyMissions.targetRegion,
  }).from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'expedition'),
      gte(armyMissions.departureTime, since24),
    ))

  const deplCount = {}
  for (const r of all24h) {
    const key = `${r.targetRealm}:${r.targetRegion}`
    deplCount[key] = (deplCount[key] ?? 0) + 1
  }
  const depletion = {}
  for (const [key, count] of Object.entries(deplCount)) {
    depletion[key] = { count, factor: depletionFactor(count) }
  }

  // Enrich with kingdom names (by userId)
  const userIds = [...new Set([...active, ...recent].map(m => m.userId))]
  const kingdomRows = userIds.length
    ? await db.select({
        userId: kingdoms.userId, name: kingdoms.name,
        realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
        isNpc: kingdoms.isNpc,
      }).from(kingdoms)
        .where(or(...userIds.map(id => eq(kingdoms.userId, id))))
    : []

  const kingdomByUser = {}
  const kingdomByPos  = {}
  for (const k of kingdomRows) {
    if (!kingdomByUser[k.userId]) kingdomByUser[k.userId] = k
    kingdomByPos[`${k.realm}:${k.region}:${k.slot}`] = k
  }

  const enrich = m => {
    // Use position-based lookup for NPCs (all share the same userId; position is unique)
    const k = kingdomByPos[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
           ?? kingdomByUser[m.userId]
    return {
      ...m,
      kingdomName: k?.name ?? '?',
      isNpc: k?.isNpc ?? false,
      result: m.result ? JSON.parse(m.result) : null,
    }
  }

  // Stats
  const stats = {
    active24h:     all24h.length,
    byRegion:      depletion,
    npcCount:      [...active, ...recent].filter(m => kingdomByUser[m.userId]?.isNpc).length,
    playerCount:   [...active, ...recent].filter(m => !kingdomByUser[m.userId]?.isNpc).length,
  }

  return res.json({
    active:    active.map(enrich),
    recent:    recent.map(enrich),
    depletion,
    stats,
    now,
  })
}
