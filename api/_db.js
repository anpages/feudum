import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import {
  pgTable, serial, integer, varchar, real, timestamp, text,
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
  alchemistTower: integer('alchemist_tower').default(0).notNull(),
  ambassadorHall: integer('ambassador_hall').default(0).notNull(),
  armoury:        integer('armoury').default(0).notNull(),

  // Military units
  squire:       integer('squire').default(0).notNull(),
  knight:       integer('knight').default(0).notNull(),
  paladin:      integer('paladin').default(0).notNull(),
  warlord:      integer('warlord').default(0).notNull(),
  grandKnight:  integer('grand_knight').default(0).notNull(),
  siegeMaster:  integer('siege_master').default(0).notNull(),
  warMachine:   integer('war_machine').default(0).notNull(),
  dragonKnight: integer('dragon_knight').default(0).notNull(),
  merchant:     integer('merchant').default(0).notNull(),
  caravan:      integer('caravan').default(0).notNull(),
  colonist:     integer('colonist').default(0).notNull(),
  scavenger:    integer('scavenger').default(0).notNull(),
  scout:        integer('scout').default(0).notNull(),
  beacon:       integer('beacon').default(0).notNull(),

  // Defenses
  archer:       integer('archer').default(0).notNull(),
  crossbowman:  integer('crossbowman').default(0).notNull(),
  ballista:     integer('ballista').default(0).notNull(),
  trebuchet:    integer('trebuchet').default(0).notNull(),
  mageTower:    integer('mage_tower').default(0).notNull(),
  dragonCannon: integer('dragon_cannon').default(0).notNull(),
  palisade:     integer('palisade').default(0).notNull(),
  castleWall:   integer('castle_wall').default(0).notNull(),
  moat:         integer('moat').default(0).notNull(),
  catapult:     integer('catapult').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const research = pgTable('research', {
  id:     serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id).unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const unitQueue = pgTable('unit_queue', {
  id:         serial('id').primaryKey(),
  kingdomId:  integer('kingdom_id').notNull().references(() => kingdoms.id),
  unit:       varchar('unit', { length: 50 }).notNull(),
  amount:     integer('amount').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const researchQueue = pgTable('research_queue', {
  id:         serial('id').primaryKey(),
  userId:     integer('user_id').notNull().references(() => users.id),
  kingdomId:  integer('kingdom_id').notNull().references(() => kingdoms.id),
  research:   varchar('research', { length: 50 }).notNull(),
  level:      integer('level').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
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

export const armyMissions = pgTable('army_missions', {
  id:          serial('id').primaryKey(),
  userId:      integer('user_id').notNull().references(() => users.id),
  missionType: varchar('mission_type', { length: 20 }).notNull(),
  state:       varchar('state', { length: 10 }).notNull().default('active'),

  startRealm:  integer('start_realm').notNull(),
  startRegion: integer('start_region').notNull(),
  startSlot:   integer('start_slot').notNull(),

  targetRealm:  integer('target_realm').notNull(),
  targetRegion: integer('target_region').notNull(),
  targetSlot:   integer('target_slot').notNull(),

  departureTime: integer('departure_time').notNull(),
  arrivalTime:   integer('arrival_time').notNull(),
  returnTime:    integer('return_time'),

  woodLoad:  real('wood_load').default(0).notNull(),
  stoneLoad: real('stone_load').default(0).notNull(),
  grainLoad: real('grain_load').default(0).notNull(),

  squire:       integer('squire').default(0).notNull(),
  knight:       integer('knight').default(0).notNull(),
  paladin:      integer('paladin').default(0).notNull(),
  warlord:      integer('warlord').default(0).notNull(),
  grandKnight:  integer('grand_knight').default(0).notNull(),
  siegeMaster:  integer('siege_master').default(0).notNull(),
  warMachine:   integer('war_machine').default(0).notNull(),
  dragonKnight: integer('dragon_knight').default(0).notNull(),
  merchant:     integer('merchant').default(0).notNull(),
  caravan:      integer('caravan').default(0).notNull(),
  colonist:     integer('colonist').default(0).notNull(),
  scavenger:    integer('scavenger').default(0).notNull(),
  scout:        integer('scout').default(0).notNull(),

  result:    text('result'),   // JSON string: battle outcome, spy report, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Connection ────────────────────────────────────────────────────────────────

const sql = neon(process.env.DATABASE_URL)
export const db = drizzle(sql, { schema: { users, kingdoms, research, researchQueue, buildingQueue, unitQueue, armyMissions } })
