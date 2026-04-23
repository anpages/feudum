import { pgTable, uuid, integer, real, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const debrisFields = pgTable('debris_fields', {
  id:        uuid('id').primaryKey().defaultRandom(),
  realm:     integer('realm').notNull(),
  region:    integer('region').notNull(),
  slot:      integer('slot').notNull(),
  wood:      real('wood').default(0).notNull(),
  stone:     real('stone').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, t => [
  uniqueIndex('debris_fields_coords_idx').on(t.realm, t.region, t.slot),
])

export type DebrisField = typeof debrisFields.$inferSelect
