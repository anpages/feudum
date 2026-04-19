import { eq, and, lte } from 'drizzle-orm'
import {
  db, kingdoms, research as researchTable,
  buildingQueue, researchQueue, unitQueue,
} from '../_db.js'
import { applyBuildingEffect } from './buildings.js'

/**
 * Apply every queue row whose finishesAt <= now to the kingdom/research rows,
 * then delete the processed queue rows. Idempotent and safe to call repeatedly.
 *
 * Buildings: increment level + recompute production / capacity via applyBuildingEffect.
 * Research:  increment level on the research row (single row per user).
 * Units:     add `amount` to the corresponding kingdom column.
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

  // Reload kingdom (and research) after queries so the patch we build is consistent
  const [[kingdom], [resRow]] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.id, kingdomId)).limit(1),
    userId
      ? db.select().from(researchTable).where(eq(researchTable.userId, userId)).limit(1)
      : Promise.resolve([null]),
  ])
  if (!kingdom) return 0

  // ── Buildings: fold each completed item into a single patch ─────────────────
  const projected = { ...kingdom }
  const buildingPatch = {}
  for (const row of bq) {
    Object.assign(projected,     applyBuildingEffect(row.building, row.level, projected))
    Object.assign(buildingPatch, applyBuildingEffect(row.building, row.level, projected))
  }

  // ── Units: add amount per row ───────────────────────────────────────────────
  const unitPatch = {}
  for (const row of uq) {
    unitPatch[row.unit] = (unitPatch[row.unit] ?? kingdom[row.unit] ?? 0) + row.amount
  }

  // ── Research: pick the highest level per techId ────────────────────────────
  const researchPatch = {}
  for (const row of rq) {
    if ((researchPatch[row.research] ?? -1) < row.level) researchPatch[row.research] = row.level
  }

  // ── Persist + delete processed queue rows in parallel ───────────────────────
  const ops = []

  if (Object.keys(buildingPatch).length > 0 || Object.keys(unitPatch).length > 0) {
    ops.push(db.update(kingdoms)
      .set({ ...buildingPatch, ...unitPatch, updatedAt: new Date() })
      .where(eq(kingdoms.id, kingdomId)))
  }

  if (Object.keys(researchPatch).length > 0 && resRow) {
    ops.push(db.update(researchTable)
      .set({ ...researchPatch, updatedAt: new Date() })
      .where(eq(researchTable.userId, userId)))
  }

  if (bq.length > 0) ops.push(db.delete(buildingQueue).where(and(
    eq(buildingQueue.kingdomId, kingdomId), lte(buildingQueue.finishesAt, now))))
  if (rq.length > 0) ops.push(db.delete(researchQueue).where(and(
    eq(researchQueue.userId, userId), lte(researchQueue.finishesAt, now))))
  if (uq.length > 0) ops.push(db.delete(unitQueue).where(and(
    eq(unitQueue.kingdomId, kingdomId), lte(unitQueue.finishesAt, now))))

  await Promise.all(ops)
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
  return total
}
