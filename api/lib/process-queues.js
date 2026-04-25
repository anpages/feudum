import { eq, and, lte, gt } from 'drizzle-orm'
import {
  db, kingdoms, buildingQueue, researchQueue, unitQueue,
} from '../_db.js'
import { applyBuildingEffect } from './buildings.js'
import { getBuildingMap, getUnitMap, upsertBuilding, upsertUnit, upsertResearch } from './db-helpers.js'

const KINGDOM_PRODUCTION_KEYS = new Set([
  'woodProduction', 'stoneProduction', 'grainProduction',
  'woodCapacity', 'stoneCapacity', 'grainCapacity',
])

/**
 * Apply every queue row whose finishesAt <= now to the buildings/units/research tables,
 * then delete the processed queue rows. Idempotent and safe to call repeatedly.
 *
 * Buildings: upsert level in buildings table + update kingdom production/capacity columns.
 * Research:  upsert level in research table (normalized rows per user+type).
 * Units:     add amount to units table (normalized rows per kingdom+type).
 *
 * Returns the number of rows processed across all three queues.
 */
export async function processKingdomQueues(kingdomId, userId) {
  const now = Math.floor(Date.now() / 1000)

  const [bq, rq, uq] = await Promise.all([
    db.select().from(buildingQueue)
      .where(and(eq(buildingQueue.kingdomId, kingdomId), lte(buildingQueue.finishesAt, now)))
      .orderBy(buildingQueue.finishesAt),
    userId
      ? db.select().from(researchQueue)
          .where(and(eq(researchQueue.userId, userId), lte(researchQueue.finishesAt, now)))
          .orderBy(researchQueue.finishesAt)
      : Promise.resolve([]),
    db.select().from(unitQueue)
      .where(and(eq(unitQueue.kingdomId, kingdomId), lte(unitQueue.finishesAt, now)))
      .orderBy(unitQueue.finishesAt),
  ])

  if (bq.length === 0 && rq.length === 0 && uq.length === 0) return 0

  const [[kingdom]] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.id, kingdomId)).limit(1),
  ])
  if (!kingdom) return 0

  // ── Buildings: apply effects, upsert level, update kingdom production/capacity ──
  if (bq.length > 0) {
    const bMap = await getBuildingMap(kingdomId)
    const projected = { ...kingdom, ...bMap }
    const kingdomProductionPatch = {}

    for (const row of bq) {
      const effect = applyBuildingEffect(row.buildingType, row.level, projected)
      for (const [k, v] of Object.entries(effect)) {
        if (KINGDOM_PRODUCTION_KEYS.has(k)) {
          kingdomProductionPatch[k] = v
          projected[k] = v
        } else {
          // k is the building type name — upsert into buildings table
          await upsertBuilding(kingdomId, k, v)
          projected[k] = v
        }
      }
    }

    if (Object.keys(kingdomProductionPatch).length > 0) {
      await db.update(kingdoms)
        .set({ ...kingdomProductionPatch, updatedAt: new Date() })
        .where(eq(kingdoms.id, kingdomId))
    }

    await db.delete(buildingQueue).where(
      and(eq(buildingQueue.kingdomId, kingdomId), lte(buildingQueue.finishesAt, now))
    )
  }

  // ── Units: add amount to units table ──────────────────────────────────────────
  if (uq.length > 0) {
    const currentUnitMap = await getUnitMap(kingdomId)
    const deltaMap = {}
    for (const row of uq) {
      deltaMap[row.unitType] = (deltaMap[row.unitType] ?? 0) + row.amount
    }
    for (const [type, delta] of Object.entries(deltaMap)) {
      await upsertUnit(kingdomId, type, (currentUnitMap[type] ?? 0) + delta)
    }
    await db.delete(unitQueue).where(
      and(eq(unitQueue.kingdomId, kingdomId), lte(unitQueue.finishesAt, now))
    )
  }

  // ── Research: upsert level in research table ──────────────────────────────────
  // OGame mechanic: if the academy (research lab) is still being upgraded in the
  // linked kingdom, skip processing — research resumes once academy is done.
  if (rq.length > 0 && userId) {
    const kingdomIds = [...new Set(rq.map(r => r.kingdomId).filter(Boolean))]
    const academyBuilding = kingdomIds.length
      ? await db.select({ kingdomId: buildingQueue.kingdomId })
          .from(buildingQueue)
          .where(and(
            eq(buildingQueue.buildingType, 'academy'),
            lte(buildingQueue.startedAt, now),
            gt(buildingQueue.finishesAt, now),
          ))
          .limit(1)
      : []
    const blockedKingdoms = new Set(academyBuilding.map(r => r.kingdomId))

    const processable = rq.filter(r => !blockedKingdoms.has(r.kingdomId))
    const processableIds = new Set(processable.map(r => r.id))

    if (processable.length > 0) {
      const resMap = {}
      for (const row of processable) {
        if ((resMap[row.researchType] ?? -1) < row.level) resMap[row.researchType] = row.level
      }
      for (const [type, level] of Object.entries(resMap)) {
        await upsertResearch(userId, type, level)
      }
      // Only delete the items we actually processed (not blocked ones)
      for (const row of processable) {
        await db.delete(researchQueue).where(eq(researchQueue.id, row.id))
      }
    }
  }

  return bq.length + rq.length + uq.length
}

/**
 * Process every queue belonging to a user — across all their kingdoms (colonies).
 * Research is user-scoped and is processed exactly once.
 * Returns total rows processed.
 */
export async function processUserQueues(userId) {
  const kingdomRows = await db.select({ id: kingdoms.id })
    .from(kingdoms).where(eq(kingdoms.userId, userId))
  let total = 0
  for (let i = 0; i < kingdomRows.length; i++) {
    total += await processKingdomQueues(kingdomRows[i].id, i === 0 ? userId : null)
  }
  // Check achievements whenever a queue item completes
  if (total > 0 && userId) {
    try {
      const { checkAndUnlock } = await import('./achievements.js')
      await checkAndUnlock(userId)
    } catch { /* non-fatal */ }
  }
  return total
}
