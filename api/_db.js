import './lib/env.js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import {
  pgTable, pgEnum, integer, varchar, real, timestamp, text, boolean, uuid, jsonb, serial,
} from 'drizzle-orm/pg-core'

export const userRoleEnum = pgEnum('user_role', ['human', 'npc', 'admin'])

export const users = pgTable('users', {
  id:             uuid('id').primaryKey(),
  username:       varchar('username',  { length: 50  }).unique(),
  email:          varchar('email',     { length: 255 }).unique(),
  avatarUrl:      varchar('avatar_url',{ length: 500 }),
  role:           userRoleEnum('role').default('human').notNull(),
  ether:          integer('ether').default(0).notNull(),
  characterClass: varchar('character_class', { length: 20 }),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
})

export const kingdoms = pgTable('kingdoms', {
  id:     uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:   varchar('name', { length: 100 }).notNull(),
  realm:  integer('realm').notNull(),
  region: integer('region').notNull(),
  slot:   integer('slot').notNull(),

  wood:               real('wood').default(500).notNull(),
  woodProduction:     real('wood_production').default(0).notNull(),
  woodCapacity:       real('wood_capacity').default(10000).notNull(),
  stone:              real('stone').default(500).notNull(),
  stoneProduction:    real('stone_production').default(0).notNull(),
  stoneCapacity:      real('stone_capacity').default(10000).notNull(),
  grain:              real('grain').default(500).notNull(),
  grainProduction:    real('grain_production').default(0).notNull(),
  grainCapacity:      real('grain_capacity').default(10000).notNull(),
  lastResourceUpdate: integer('last_resource_update').default(0).notNull(),
  productionSettings: jsonb('production_settings').default({}).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

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

export const buildings = pgTable('buildings', {
  id:        uuid('id').primaryKey().defaultRandom(),
  kingdomId: uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 50 }).notNull(),
  level:     integer('level').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const units = pgTable('units', {
  id:        uuid('id').primaryKey().defaultRandom(),
  kingdomId: uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 50 }).notNull(),
  quantity:  integer('quantity').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const research = pgTable('research', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 50 }).notNull(),
  level:     integer('level').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const buildingQueue = pgTable('building_queue', {
  id:           uuid('id').primaryKey().defaultRandom(),
  kingdomId:    uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  buildingType: varchar('building_type', { length: 50 }).notNull(),
  level:        integer('level').notNull(),
  startedAt:    integer('started_at').notNull(),
  finishesAt:   integer('finishes_at').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

export const researchQueue = pgTable('research_queue', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kingdomId:    uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  researchType: varchar('research_type', { length: 50 }).notNull(),
  level:        integer('level').notNull(),
  startedAt:    integer('started_at').notNull(),
  finishesAt:   integer('finishes_at').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
})

export const unitQueue = pgTable('unit_queue', {
  id:         uuid('id').primaryKey().defaultRandom(),
  kingdomId:  uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  unitType:   varchar('unit_type', { length: 50 }).notNull(),
  amount:     integer('amount').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const armyMissions = pgTable('army_missions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originKingdomId:  uuid('origin_kingdom_id').references(() => kingdoms.id, { onDelete: 'set null' }),
  missionType:      varchar('mission_type', { length: 20 }).notNull(),
  state:            varchar('state', { length: 10 }).notNull().default('active'),

  startRealm:  integer('start_realm').notNull(),
  startRegion: integer('start_region').notNull(),
  startSlot:   integer('start_slot').notNull(),

  targetRealm:  integer('target_realm').notNull(),
  targetRegion: integer('target_region').notNull(),
  targetSlot:   integer('target_slot').notNull(),

  departureTime: integer('departure_time').notNull(),
  arrivalTime:   integer('arrival_time').notNull(),
  holdingTime:   integer('holding_time').default(0).notNull(),
  returnTime:    integer('return_time'),

  woodLoad:  real('wood_load').default(0).notNull(),
  stoneLoad: real('stone_load').default(0).notNull(),
  grainLoad: real('grain_load').default(0).notNull(),

  units: jsonb('units').default({}).notNull(),

  result:    text('result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const debrisFields = pgTable('debris_fields', {
  id:        uuid('id').primaryKey().defaultRandom(),
  realm:     integer('realm').notNull(),
  region:    integer('region').notNull(),
  slot:      integer('slot').notNull(),
  wood:      real('wood').default(0).notNull(),
  stone:     real('stone').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const messages = pgTable('messages', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  senderId:  uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
  type:      varchar('type', { length: 20 }).notNull(),
  subject:   varchar('subject', { length: 255 }).notNull(),
  data:      jsonb('data').default({}).notNull(),
  viewed:    boolean('viewed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const settings = pgTable('settings', {
  key:       varchar('key',   { length: 100 }).primaryKey(),
  value:     text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const userAchievements = pgTable('user_achievements', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: varchar('achievement_id', { length: 60 }).notNull(),
  unlockedAt:    timestamp('unlocked_at').defaultNow().notNull(),
  claimedAt:     timestamp('claimed_at'),
})

export const pushSubscriptions = pgTable('push_subscriptions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint:  text('endpoint').notNull().unique(),
  p256dh:    text('p256dh').notNull(),
  auth:      text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const etherTransactions = pgTable('ether_transactions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:      text('type').notNull(),
  amount:    integer('amount').notNull(),
  reason:    text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const battleLog = pgTable('battle_log', {
  id:                uuid('id').primaryKey().defaultRandom(),
  attackerKingdomId: uuid('attacker_kingdom_id').references(() => kingdoms.id, { onDelete: 'set null' }),
  attackerName:      varchar('attacker_name', { length: 100 }).notNull(),
  attackerCoord:     varchar('attacker_coord', { length: 30 }).notNull(),
  attackerIsNpc:     boolean('attacker_is_npc').default(false).notNull(),
  defenderKingdomId: uuid('defender_kingdom_id').references(() => kingdoms.id, { onDelete: 'set null' }),
  defenderName:      varchar('defender_name', { length: 100 }).notNull(),
  defenderCoord:     varchar('defender_coord', { length: 30 }).notNull(),
  defenderIsNpc:     boolean('defender_is_npc').default(false).notNull(),
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

export const seasonSnapshots = pgTable('season_snapshots', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id'),  // no FK — historical data, user may be deleted
  seasonNumber:     integer('season_number').notNull(),
  username:         varchar('username', { length: 50 }),
  rank:             integer('rank'),
  points:           integer('points').notNull().default(0),
  buildingPoints:   integer('building_points').notNull().default(0),
  researchPoints:   integer('research_points').notNull().default(0),
  unitPoints:       integer('unit_points').notNull().default(0),
  achievementsCount: integer('achievements_count').notNull().default(0),
  kingdomsCount:    integer('kingdoms_count').notNull().default(0),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
})

// prepare: false required for PgBouncer transaction pooling
const client = postgres(process.env.STORAGE_POSTGRES_URL, { prepare: false })
export const db = drizzle(client, { schema: {
  users, kingdoms, npcState, buildings, units, research,
  buildingQueue, researchQueue, unitQueue, armyMissions,
  debrisFields, messages, settings, userAchievements, pushSubscriptions,
  etherTransactions, battleLog, seasonSnapshots,
}})
