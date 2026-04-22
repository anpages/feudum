import { pgTable, uuid, integer, varchar, timestamp } from 'drizzle-orm/pg-core'
import { kingdoms } from './kingdoms'
import { users } from './users'

export const buildingQueue = pgTable('building_queue', {
  id:         uuid('id').primaryKey().defaultRandom(),
  kingdomId:  uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  building:   varchar('building', { length: 50 }).notNull(),
  level:      integer('level').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const researchQueue = pgTable('research_queue', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kingdomId:  uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  research:   varchar('research', { length: 50 }).notNull(),
  level:      integer('level').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})


export const unitQueue = pgTable('unit_queue', {
  id:         uuid('id').primaryKey().defaultRandom(),
  kingdomId:  uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  unit:       varchar('unit', { length: 50 }).notNull(),
  amount:     integer('amount').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})
