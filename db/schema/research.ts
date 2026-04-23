import { pgTable, uuid, varchar, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'

/**
 * One row per (user, research type). Missing row = level 0.
 * Research is per-user: human players share it across all their kingdoms;
 * NPC users each own exactly one kingdom so it is effectively per-kingdom.
 *
 * Type values (camelCase):
 * swordsmanship | armoury | fortification | horsemanship | cartography |
 * tradeRoutes | alchemy | pyromancy | runemastery | mysticism | dragonlore |
 * spycraft | logistics | exploration | diplomaticNetwork | divineBlessing
 */
export const research = pgTable('research', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 50 }).notNull(),
  level:     integer('level').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, t => [
  uniqueIndex('research_user_type_idx').on(t.userId, t.type),
])

export type Research    = typeof research.$inferSelect
export type NewResearch = typeof research.$inferInsert
