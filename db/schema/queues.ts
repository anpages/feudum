import { pgTable, serial, integer, varchar, timestamp } from 'drizzle-orm/pg-core'
import { kingdoms } from './kingdoms'
import { users } from './users'

export const buildingQueue = pgTable('building_queue', {
  id: serial('id').primaryKey(),
  kingdomId: integer('kingdom_id').notNull().references(() => kingdoms.id),
  building: varchar('building', { length: 50 }).notNull(),
  level: integer('level').notNull(),
  startedAt: integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const researchQueue = pgTable('research_queue', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  kingdomId: integer('kingdom_id').notNull().references(() => kingdoms.id),
  research: varchar('research', { length: 50 }).notNull(),
  level: integer('level').notNull(),
  startedAt: integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const unitQueue = pgTable('unit_queue', {
  id: serial('id').primaryKey(),
  kingdomId: integer('kingdom_id').notNull().references(() => kingdoms.id),
  unit: varchar('unit', { length: 50 }).notNull(),
  amount: integer('amount').notNull(),
  startedAt: integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
