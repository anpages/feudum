import { pgTable, serial, integer, real, timestamp } from 'drizzle-orm/pg-core'

export const debrisFields = pgTable('debris_fields', {
  id:        serial('id').primaryKey(),
  realm:     integer('realm').notNull(),
  region:    integer('region').notNull(),
  slot:      integer('slot').notNull(),
  wood:      real('wood').default(0).notNull(),
  stone:     real('stone').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type DebrisField = typeof debrisFields.$inferSelect
