import { pgTable, serial, integer, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const messages = pgTable('messages', {
  id:        serial('id').primaryKey(),
  userId:    integer('user_id').notNull().references(() => users.id),
  type:      varchar('type', { length: 20 }).notNull(),   // 'battle' | 'spy' | 'system'
  subject:   varchar('subject', { length: 255 }).notNull(),
  data:      text('data').notNull(),                       // JSON payload
  viewed:    boolean('viewed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Message    = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
