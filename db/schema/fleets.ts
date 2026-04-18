import { pgTable, serial, integer, varchar, real, timestamp, text } from 'drizzle-orm/pg-core'
import { users } from './users'

// Equivalent to OGame fleet_missions — armies marching between kingdoms
export const armyMissions = pgTable('army_missions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  missionType: varchar('mission_type', { length: 20 }).notNull(), // attack | transport | colonize | spy | pillage | return
  state: varchar('state', { length: 10 }).notNull().default('active'), // active | returning | arrived

  // Origin
  startRealm: integer('start_realm').notNull(),
  startRegion: integer('start_region').notNull(),
  startSlot: integer('start_slot').notNull(),

  // Destination
  targetRealm: integer('target_realm').notNull(),
  targetRegion: integer('target_region').notNull(),
  targetSlot: integer('target_slot').notNull(),

  // Timing
  departureTime: integer('departure_time').notNull(),
  arrivalTime: integer('arrival_time').notNull(),
  returnTime: integer('return_time'),

  // Transported resources
  woodLoad: real('wood_load').default(0).notNull(),
  stoneLoad: real('stone_load').default(0).notNull(),
  grainLoad: real('grain_load').default(0).notNull(),

  // Army composition (mirrors units in kingdoms)
  squire: integer('squire').default(0).notNull(),
  knight: integer('knight').default(0).notNull(),
  paladin: integer('paladin').default(0).notNull(),
  warlord: integer('warlord').default(0).notNull(),
  grandKnight: integer('grand_knight').default(0).notNull(),
  siegeMaster: integer('siege_master').default(0).notNull(),
  warMachine: integer('war_machine').default(0).notNull(),
  dragonKnight: integer('dragon_knight').default(0).notNull(),
  merchant: integer('merchant').default(0).notNull(),
  caravan: integer('caravan').default(0).notNull(),
  colonist: integer('colonist').default(0).notNull(),
  scavenger: integer('scavenger').default(0).notNull(),
  scout: integer('scout').default(0).notNull(),

  result: text('result'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type ArmyMission = typeof armyMissions.$inferSelect
export type NewArmyMission = typeof armyMissions.$inferInsert
