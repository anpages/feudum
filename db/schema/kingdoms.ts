import { pgTable, uuid, integer, varchar, real, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const kingdoms = pgTable('kingdoms', {
  id:     uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:   varchar('name', { length: 100 }).notNull(),

  realm:  integer('realm').notNull(),
  region: integer('region').notNull(),
  slot:   integer('slot').notNull(),

  wood:               real('wood').default(500).notNull(),
  woodProduction:     real('wood_production').default(0).notNull(),
  woodCapacity:       real('wood_capacity').default(10000).notNull(),
  stone:              real('stone').default(500).notNull(),
  stoneProduction:    real('stone_production').default(0).notNull(),
  stoneCapacity:      real('stone_capacity').default(10000).notNull(),
  grain:              real('grain').default(500).notNull(),
  grainProduction:    real('grain_production').default(0).notNull(),
  grainCapacity:      real('grain_capacity').default(10000).notNull(),
  lastResourceUpdate: integer('last_resource_update').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Kingdom    = typeof kingdoms.$inferSelect
export type NewKingdom = typeof kingdoms.$inferInsert
