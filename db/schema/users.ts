import { pgTable, pgEnum, timestamp, varchar, integer, text, uuid } from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['human', 'npc', 'admin'])

export const users = pgTable('users', {
  id:             uuid('id').primaryKey(),
  username:       varchar('username',  { length: 50  }).unique(),
  email:          varchar('email',     { length: 255 }).notNull().unique(),
  avatarUrl:      varchar('avatar_url',{ length: 500 }),
  role:           userRoleEnum('role').default('human').notNull(),
  ether:          integer('ether').default(0).notNull(),
  characterClass: varchar('character_class', { length: 20 }),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
})

export const etherTransactions = pgTable('ether_transactions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:      text('type').notNull(),
  amount:    integer('amount').notNull(),
  reason:    text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type User    = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
