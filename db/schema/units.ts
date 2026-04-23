import { pgTable, uuid, varchar, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { kingdoms } from './kingdoms'

/**
 * One row per (kingdom, unit type). Missing row = quantity 0.
 * Includes both mobile units and static defenses.
 * Type values match the camelCase keys used in api/lib/units.js:
 *
 * Mobile:  squire | knight | paladin | warlord | grandKnight | siegeMaster |
 *          warMachine | dragonKnight | merchant | caravan | colonist |
 *          scavenger | scout | beacon | ballistic
 *
 * Defense: archer | crossbowman | ballista | trebuchet | mageTower |
 *          dragonCannon | palisade | castleWall | moat | catapult
 */
export const units = pgTable('units', {
  id:        uuid('id').primaryKey().defaultRandom(),
  kingdomId: uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 50 }).notNull(),
  quantity:  integer('quantity').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, t => [
  uniqueIndex('units_kingdom_type_idx').on(t.kingdomId, t.type),
])

export type Unit    = typeof units.$inferSelect
export type NewUnit = typeof units.$inferInsert
