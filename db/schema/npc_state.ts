import { pgTable, uuid, integer, varchar, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * AI state for NPC users (role='npc'). One row per NPC user.
 * Human users have no row here.
 */
export const npcState = pgTable('npc_state', {
  userId:              uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  isBoss:              boolean('is_boss').default(false).notNull(),
  npcLevel:            integer('npc_level').default(1).notNull(),
  npcClass:            varchar('npc_class', { length: 20 }),
  buildAvailableAt:    integer('build_available_at'),
  lastBuildAt:         integer('last_build_at').default(0).notNull(),
  lastAttackAt:        integer('last_attack_at').default(0).notNull(),
  nextCheck:           integer('next_check'),
  lastDecision:        varchar('last_decision', { length: 255 }),
  currentResearch:     varchar('current_research', { length: 50 }),
  researchAvailableAt: integer('research_available_at'),
  currentTask:         jsonb('current_task'),
  createdAt:           timestamp('created_at').defaultNow().notNull(),
  updatedAt:           timestamp('updated_at').defaultNow().notNull(),
})

export type NpcState    = typeof npcState.$inferSelect
export type NewNpcState = typeof npcState.$inferInsert
