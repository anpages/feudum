import { pgTable, uuid, integer, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const research = pgTable('research', {
  id:     uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),

  swordsmanship:     integer('swordsmanship').default(0).notNull(),
  armoury:           integer('armoury').default(0).notNull(),
  fortification:     integer('fortification').default(0).notNull(),

  horsemanship:      integer('horsemanship').default(0).notNull(),
  cartography:       integer('cartography').default(0).notNull(),
  tradeRoutes:       integer('trade_routes').default(0).notNull(),

  alchemy:           integer('alchemy').default(0).notNull(),
  pyromancy:         integer('pyromancy').default(0).notNull(),
  runemastery:       integer('runemastery').default(0).notNull(),
  mysticism:         integer('mysticism').default(0).notNull(),
  dragonlore:        integer('dragonlore').default(0).notNull(),

  spycraft:          integer('spycraft').default(0).notNull(),
  logistics:         integer('logistics').default(0).notNull(),
  exploration:       integer('exploration').default(0).notNull(),
  diplomaticNetwork: integer('diplomatic_network').default(0).notNull(),
  divineBlessing:    integer('divine_blessing').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Research    = typeof research.$inferSelect
export type NewResearch = typeof research.$inferInsert
