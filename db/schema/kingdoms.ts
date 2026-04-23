import { pgTable, uuid, integer, varchar, real, timestamp, boolean } from 'drizzle-orm/pg-core'
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

  tempAvg:          integer('temp_avg').default(0).notNull(),
  sawmillPercent:   integer('sawmill_percent').default(10).notNull(),
  quarryPercent:    integer('quarry_percent').default(10).notNull(),
  grainFarmPercent: integer('grain_farm_percent').default(10).notNull(),
  windmillPercent:  integer('windmill_percent').default(10).notNull(),
  cathedralPercent: integer('cathedral_percent').default(10).notNull(),

  // Denormalized for query performance — always mirrors users.role === 'npc'
  isNpc:  boolean('is_npc').default(false).notNull(),
  isBoss: boolean('is_boss').default(false).notNull(),

  npcLevel:               integer('npc_level').default(0),
  npcBuildAvailableAt:    integer('npc_build_available_at').default(0),
  npcLastBuildAt:         integer('npc_last_build_at').default(0),
  npcLastAttackAt:        integer('npc_last_attack_at').default(0),
  npcNextCheck:           integer('npc_next_check'),
  lastDecision:           varchar('last_decision', { length: 255 }),
  npcCurrentResearch:     varchar('npc_current_research', { length: 50 }),
  npcResearchAvailableAt: integer('npc_research_available_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Kingdom    = typeof kingdoms.$inferSelect
export type NewKingdom = typeof kingdoms.$inferInsert
