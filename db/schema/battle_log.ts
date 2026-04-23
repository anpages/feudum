import { pgTable, uuid, varchar, real, integer, timestamp } from 'drizzle-orm/pg-core'
import { kingdoms } from './kingdoms'

export const battleLog = pgTable('battle_log', {
  id:                uuid('id').primaryKey().defaultRandom(),
  // Nullable FKs: kingdom may be deleted but battle history must persist
  attackerKingdomId: uuid('attacker_kingdom_id').references(() => kingdoms.id, { onDelete: 'set null' }),
  attackerName:      varchar('attacker_name', { length: 100 }).notNull(),
  attackerCoord:     varchar('attacker_coord', { length: 30 }).notNull(),
  defenderKingdomId: uuid('defender_kingdom_id').references(() => kingdoms.id, { onDelete: 'set null' }),
  defenderName:      varchar('defender_name', { length: 100 }).notNull(),
  defenderCoord:     varchar('defender_coord', { length: 30 }).notNull(),
  missionType:       varchar('mission_type', { length: 20 }).notNull(),
  outcome:           varchar('outcome', { length: 10 }).notNull(),
  lootWood:          real('loot_wood').default(0).notNull(),
  lootStone:         real('loot_stone').default(0).notNull(),
  lootGrain:         real('loot_grain').default(0).notNull(),
  attackerLosses:    integer('attacker_losses').default(0).notNull(),
  defenderLosses:    integer('defender_losses').default(0).notNull(),
  rounds:            integer('rounds').default(0).notNull(),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
})

export type BattleLogEntry = typeof battleLog.$inferSelect
