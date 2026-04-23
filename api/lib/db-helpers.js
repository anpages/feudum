import { eq, and, inArray } from 'drizzle-orm'
import { db, buildings, units, research, npcState, users, kingdoms } from '../_db.js'

export async function getBuildingMap(kingdomId) {
  const rows = await db.select().from(buildings).where(eq(buildings.kingdomId, kingdomId))
  return Object.fromEntries(rows.map(r => [r.type, r.level]))
}

export async function getUnitMap(kingdomId) {
  const rows = await db.select().from(units).where(eq(units.kingdomId, kingdomId))
  return Object.fromEntries(rows.map(r => [r.type, r.quantity]))
}

export async function getResearchMap(userId) {
  const rows = await db.select().from(research).where(eq(research.userId, userId))
  return Object.fromEntries(rows.map(r => [r.type, r.level]))
}

// Returns kingdom enriched with buildingMap (and optionally unitMap) merged in.
// Callers can then use kingdom.sawmill, kingdom.squire, etc. as before.
export async function enrichKingdom(kingdom, opts = {}) {
  const [bMap, uMap] = await Promise.all([
    getBuildingMap(kingdom.id),
    opts.withUnits ? getUnitMap(kingdom.id) : Promise.resolve({}),
  ])
  return { ...kingdom, ...bMap, ...uMap }
}

// Fetch kingdom at given coords enriched with isNpc/isBoss/npcLevel from joins.
// Returns null if no kingdom at those coords.
export async function getKingdomAt(realm, region, slot) {
  const rows = await db
    .select({
      k: kingdoms,
      userRole: users.role,
      ns: npcState,
    })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .leftJoin(npcState, eq(kingdoms.userId, npcState.userId))
    .where(and(
      eq(kingdoms.realm, realm),
      eq(kingdoms.region, region),
      eq(kingdoms.slot, slot),
    ))
    .limit(1)
  if (rows.length === 0) return null
  const { k, userRole, ns } = rows[0]
  return {
    ...k,
    isNpc:    userRole === 'npc',
    isBoss:   ns?.isBoss   ?? false,
    npcLevel: ns?.npcLevel ?? 1,
  }
}

// Bulk variants — fetch all rows for multiple IDs in a single query.
// Returns a map: { [id]: { [type]: value } }

export async function getBuildingMaps(kingdomIds) {
  if (!kingdomIds.length) return {}
  const rows = await db.select().from(buildings).where(inArray(buildings.kingdomId, kingdomIds))
  const result = {}
  for (const r of rows) {
    if (!result[r.kingdomId]) result[r.kingdomId] = {}
    result[r.kingdomId][r.type] = r.level
  }
  return result
}

export async function getUnitMaps(kingdomIds) {
  if (!kingdomIds.length) return {}
  const rows = await db.select().from(units).where(inArray(units.kingdomId, kingdomIds))
  const result = {}
  for (const r of rows) {
    if (!result[r.kingdomId]) result[r.kingdomId] = {}
    result[r.kingdomId][r.type] = r.quantity
  }
  return result
}

export async function getResearchMaps(userIds) {
  if (!userIds.length) return {}
  const rows = await db.select().from(research).where(inArray(research.userId, userIds))
  const result = {}
  for (const r of rows) {
    if (!result[r.userId]) result[r.userId] = {}
    result[r.userId][r.type] = r.level
  }
  return result
}

export async function upsertBuilding(kingdomId, type, level) {
  await db.insert(buildings)
    .values({ kingdomId, type, level })
    .onConflictDoUpdate({
      target: [buildings.kingdomId, buildings.type],
      set: { level, updatedAt: new Date() },
    })
}

export async function upsertUnit(kingdomId, type, quantity) {
  if (quantity <= 0) {
    await db.delete(units).where(
      and(eq(units.kingdomId, kingdomId), eq(units.type, type))
    )
    return
  }
  await db.insert(units)
    .values({ kingdomId, type, quantity })
    .onConflictDoUpdate({
      target: [units.kingdomId, units.type],
      set: { quantity, updatedAt: new Date() },
    })
}

export async function upsertResearch(userId, type, level) {
  await db.insert(research)
    .values({ userId, type, level })
    .onConflictDoUpdate({
      target: [research.userId, research.type],
      set: { level, updatedAt: new Date() },
    })
}

// Add delta to a unit quantity (reads current, then upserts sum).
export async function addUnit(kingdomId, type, delta) {
  const [row] = await db.select({ quantity: units.quantity })
    .from(units)
    .where(and(eq(units.kingdomId, kingdomId), eq(units.type, type)))
    .limit(1)
  const newQty = Math.max(0, (row?.quantity ?? 0) + delta)
  await upsertUnit(kingdomId, type, newQty)
}

// Batch upsert a full unit map {type: quantity}
export async function batchUpsertUnits(kingdomId, unitMap) {
  const entries = Object.entries(unitMap)
  for (const [type, quantity] of entries) {
    await upsertUnit(kingdomId, type, quantity)
  }
}

// Fetch npc_state for a user (returns defaults if not found)
export async function getNpcState(userId) {
  const [row] = await db.select().from(npcState)
    .where(eq(npcState.userId, userId)).limit(1)
  return row ?? {
    isBoss: false, npcLevel: 1, buildAvailableAt: null,
    lastBuildAt: 0, lastAttackAt: 0, nextCheck: null,
    lastDecision: null, currentResearch: null, researchAvailableAt: null,
  }
}
