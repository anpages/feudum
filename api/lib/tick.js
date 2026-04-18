import { eq } from 'drizzle-orm'
import { db, kingdoms } from '../_db.js'

/**
 * Compute ticked resources without writing to DB.
 * Returns updated { wood, stone, grain, now }.
 */
export function applyResourceTick(kingdom, cfg) {
  const now     = Math.floor(Date.now() / 1000)
  const elapsed = Math.max(0, now - kingdom.lastResourceUpdate) / 3600
  const speed   = cfg.economy_speed ?? 1

  if (elapsed <= 0) {
    return { wood: kingdom.wood, stone: kingdom.stone, grain: kingdom.grain, now }
  }

  return {
    wood:  Math.min(kingdom.wood  + kingdom.woodProduction  * elapsed * speed, kingdom.woodCapacity),
    stone: Math.min(kingdom.stone + kingdom.stoneProduction * elapsed * speed, kingdom.stoneCapacity),
    grain: Math.min(kingdom.grain + kingdom.grainProduction * elapsed * speed, kingdom.grainCapacity),
    now,
  }
}

/**
 * Apply resource tick and persist to DB for NPC kingdoms in the cron.
 */
export async function tickAndPersist(kingdom, cfg) {
  const ticked = applyResourceTick(kingdom, cfg)
  if (ticked.now === Math.floor(Date.now() / 1000) && ticked.wood === kingdom.wood) return kingdom

  const [updated] = await db.update(kingdoms)
    .set({
      wood:               ticked.wood,
      stone:              ticked.stone,
      grain:              ticked.grain,
      lastResourceUpdate: ticked.now,
      updatedAt:          new Date(),
    })
    .where(eq(kingdoms.id, kingdom.id))
    .returning()
  return updated
}
