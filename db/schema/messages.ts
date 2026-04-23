import { pgTable, uuid, varchar, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const messages = pgTable('messages', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Null for system messages (battle reports, etc.)
  senderId:  uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  type:      varchar('type', { length: 20 }).notNull(),
  subject:   varchar('subject', { length: 255 }).notNull(),
  data:      jsonb('data').$type<Record<string, unknown>>().notNull(),
  viewed:    boolean('viewed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Message    = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
