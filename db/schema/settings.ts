import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core'

export const settings = pgTable('settings', {
  key:       varchar('key', { length: 100 }).primaryKey(),
  value:     varchar('value', { length: 255 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Setting = typeof settings.$inferSelect
