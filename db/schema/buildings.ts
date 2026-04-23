import { pgTable, uuid, varchar, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { kingdoms } from './kingdoms'

/**
 * One row per (kingdom, building type). Missing row = level 0.
 * Type values match the camelCase keys used in api/lib/buildings.js:
 * sawmill | quarry | grainFarm | windmill | cathedral | workshop |
 * engineersGuild | barracks | granary | stonehouse | silo |
 * academy | alchemistTower | ambassadorHall | armoury
 */
export const buildings = pgTable('buildings', {
  id:        uuid('id').primaryKey().defaultRandom(),
  kingdomId: uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 50 }).notNull(),
  level:     integer('level').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, t => [
  uniqueIndex('buildings_kingdom_type_idx').on(t.kingdomId, t.type),
])

export type Building    = typeof buildings.$inferSelect
export type NewBuilding = typeof buildings.$inferInsert
