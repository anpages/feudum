import { pgTable, uuid, integer, varchar, real, timestamp, text, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * units JSONB format: { squire: 10, knight: 5, ... }
 * Only non-zero quantities are stored. Missing key = 0.
 */
export const armyMissions = pgTable('army_missions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  missionType: varchar('mission_type', { length: 20 }).notNull(),
  state:       varchar('state', { length: 10 }).notNull().default('active'),

  startRealm:  integer('start_realm').notNull(),
  startRegion: integer('start_region').notNull(),
  startSlot:   integer('start_slot').notNull(),

  targetRealm:  integer('target_realm').notNull(),
  targetRegion: integer('target_region').notNull(),
  targetSlot:   integer('target_slot').notNull(),

  departureTime: integer('departure_time').notNull(),
  arrivalTime:   integer('arrival_time').notNull(),
  holdingTime:   integer('holding_time').default(0).notNull(),
  returnTime:    integer('return_time'),

  woodLoad:  real('wood_load').default(0).notNull(),
  stoneLoad: real('stone_load').default(0).notNull(),
  grainLoad: real('grain_load').default(0).notNull(),

  units: jsonb('units').$type<Record<string, number>>().default({}).notNull(),

  result:    text('result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type ArmyMission    = typeof armyMissions.$inferSelect
export type NewArmyMission = typeof armyMissions.$inferInsert
