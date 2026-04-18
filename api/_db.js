import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import {
  pgTable, serial, integer, varchar, real, timestamp,
} from 'drizzle-orm/pg-core'

// ── Schema (mirrors db/schema/*.ts) ──────────────────────────────────────────

export const users = pgTable('users', {
  id:        serial('id').primaryKey(),
  username:  varchar('username',  { length: 50  }).unique(),
  email:     varchar('email',     { length: 255 }).notNull().unique(),
  googleId:  varchar('google_id', { length: 255 }).notNull().unique(),
  avatarUrl: varchar('avatar_url',{ length: 500 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const kingdoms = pgTable('kingdoms', {
  id:     serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  name:   varchar('name', { length: 100 }).notNull(),
  realm:  integer('realm').notNull(),
  region: integer('region').notNull(),
  slot:   integer('slot').notNull(),

  wood:            real('wood').default(500).notNull(),
  woodProduction:  real('wood_production').default(0).notNull(),
  woodCapacity:    real('wood_capacity').default(10000).notNull(),
  stone:           real('stone').default(500).notNull(),
  stoneProduction: real('stone_production').default(0).notNull(),
  stoneCapacity:   real('stone_capacity').default(10000).notNull(),
  grain:           real('grain').default(500).notNull(),
  grainProduction: real('grain_production').default(0).notNull(),
  grainCapacity:   real('grain_capacity').default(10000).notNull(),
  populationUsed:  integer('population_used').default(0).notNull(),
  populationMax:   integer('population_max').default(0).notNull(),
  lastResourceUpdate: integer('last_resource_update').default(0).notNull(),

  sawmill:        integer('sawmill').default(0).notNull(),
  quarry:         integer('quarry').default(0).notNull(),
  grainFarm:      integer('grain_farm').default(0).notNull(),
  windmill:       integer('windmill').default(0).notNull(),
  cathedral:      integer('cathedral').default(0).notNull(),
  workshop:       integer('workshop').default(0).notNull(),
  engineersGuild: integer('engineers_guild').default(0).notNull(),
  barracks:       integer('barracks').default(0).notNull(),
  granary:        integer('granary').default(0).notNull(),
  stonehouse:     integer('stonehouse').default(0).notNull(),
  silo:           integer('silo').default(0).notNull(),
  academy:        integer('academy').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const research = pgTable('research', {
  id:     serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const buildingQueue = pgTable('building_queue', {
  id:         serial('id').primaryKey(),
  kingdomId:  integer('kingdom_id').notNull().references(() => kingdoms.id),
  building:   varchar('building', { length: 50 }).notNull(),
  level:      integer('level').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

// ── Connection ────────────────────────────────────────────────────────────────

const sql = neon(process.env.DATABASE_URL)
export const db = drizzle(sql, { schema: { users, kingdoms, research, buildingQueue } })
