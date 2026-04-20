import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'

export const userAchievements = pgTable('user_achievements', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: varchar('achievement_id', { length: 60 }).notNull(),
  unlockedAt:    timestamp('unlocked_at').defaultNow().notNull(),
  claimedAt:     timestamp('claimed_at'),
}, t => ({
  uniqUserAch: uniqueIndex('user_achievements_user_id_achievement_id').on(t.userId, t.achievementId),
}))

export type UserAchievement = typeof userAchievements.$inferSelect
