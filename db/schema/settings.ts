import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core'

export const settings = pgTable('settings', {
  key:       varchar('key', { length: 100 }).primaryKey(),
  value:     text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Setting = typeof settings.$inferSelect
