import './lib/env.js'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import {
  pgTable, integer, varchar, real, timestamp, text, boolean, uuid, jsonb,
} from 'drizzle-orm/pg-core'

// ── Battle log ────────────────────────────────────────────────────────────────
export const battleLog = pgTable('battle_log', {
  id:                uuid('id').primaryKey().defaultRandom(),
  attackerKingdomId: uuid('attacker_kingdom_id'),
  attackerName:      varchar('attacker_name', { length: 100 }).notNull(),
  attackerIsNpc:     boolean('attacker_is_npc').default(false).notNull(),
  defenderKingdomId: uuid('defender_kingdom_id'),
  defenderName:      varchar('defender_name', { length: 100 }).notNull(),
  defenderIsNpc:     boolean('defender_is_npc').default(false).notNull(),
  missionType:       varchar('mission_type', { length: 20 }).notNull(),
  outcome:           varchar('outcome', { length: 10 }).notNull(),
  lootWood:          real('loot_wood').default(0).notNull(),
  lootStone:         real('loot_stone').default(0).notNull(),
  lootGrain:         real('loot_grain').default(0).notNull(),
  attackerLosses:    integer('attacker_losses').default(0).notNull(),
  defenderLosses:    integer('defender_losses').default(0).notNull(),
  rounds:            integer('rounds').default(0).notNull(),
  attackerCoord:     varchar('attacker_coord', { length: 30 }).notNull(),
  defenderCoord:     varchar('defender_coord', { length: 30 }).notNull(),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
})

// ── Schema (mirrors db/schema/*.ts) ──────────────────────────────────────────
// All ids are UUID. user.id == auth.users.id (Supabase). FKs cascade on delete.

export const users = pgTable('users', {
  id:             uuid('id').primaryKey(),
  username:       varchar('username',  { length: 50  }).unique(),
  email:          varchar('email',     { length: 255 }).notNull().unique(),
  avatarUrl:      varchar('avatar_url',{ length: 500 }),
  isAdmin:        boolean('is_admin').default(false).notNull(),
  isNpc:          boolean('is_npc').default(false).notNull(),
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

export const settings = pgTable('settings', {
  key:       varchar('key',   { length: 100 }).primaryKey(),
  value:     varchar('value', { length: 255 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const kingdoms = pgTable('kingdoms', {
  id:     uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  ballistic:    integer('ballistic').default(0).notNull(),

  tempAvg:          integer('temp_avg').default(0).notNull(),
  sawmillPercent:   integer('sawmill_percent').default(10).notNull(),
  quarryPercent:    integer('quarry_percent').default(10).notNull(),
  grainFarmPercent: integer('grain_farm_percent').default(10).notNull(),
  windmillPercent:  integer('windmill_percent').default(10).notNull(),
  cathedralPercent: integer('cathedral_percent').default(10).notNull(),

  isNpc:    boolean('is_npc').default(false).notNull(),
  isBoss:   boolean('is_boss').default(false).notNull(),
  npcLevel: integer('npc_level').default(0).notNull(),

  npcBuildAvailableAt: integer('npc_build_available_at').default(0),
  npcLastBuildAt:      integer('npc_last_build_at').default(0).notNull(),
  npcLastAttackAt:     integer('npc_last_attack_at').default(0).notNull(),

  // Lifeforms / Civilizations
  civilization:       varchar('civilization', { length: 20 }),
  civLevelRomans:     integer('civ_level_romans').default(0).notNull(),
  civLevelVikings:    integer('civ_level_vikings').default(0).notNull(),
  civLevelByzantines: integer('civ_level_byzantines').default(0).notNull(),
  civLevelSaracens:   integer('civ_level_saracens').default(0).notNull(),
  populationT1:       real('population_t1').default(0).notNull(),
  populationT2:       real('population_t2').default(0).notNull(),
  populationT3:       real('population_t3').default(0).notNull(),
  foodStored:         real('food_stored').default(0).notNull(),
  foodLastUpdate:     integer('food_last_update').default(0).notNull(),
  artifacts:          integer('artifacts').default(0).notNull(),
  lfBuildings:        jsonb('lf_buildings').default({}).notNull(),
  lfResearch:         jsonb('lf_research').default({}).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const research = pgTable('research', {
  id:     uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),

  // Combat
  swordsmanship: integer('swordsmanship').default(0).notNull(),
  armoury:       integer('armoury').default(0).notNull(),
  fortification: integer('fortification').default(0).notNull(),

  // Logistics
  horsemanship:  integer('horsemanship').default(0).notNull(),
  cartography:   integer('cartography').default(0).notNull(),
  tradeRoutes:   integer('trade_routes').default(0).notNull(),

  // Mystical / Science
  alchemy:       integer('alchemy').default(0).notNull(),
  pyromancy:     integer('pyromancy').default(0).notNull(),
  runemastery:   integer('runemastery').default(0).notNull(),
  mysticism:     integer('mysticism').default(0).notNull(),
  dragonlore:    integer('dragonlore').default(0).notNull(),

  // Intelligence & Expansion
  spycraft:          integer('spycraft').default(0).notNull(),
  logistics:         integer('logistics').default(0).notNull(),
  exploration:       integer('exploration').default(0).notNull(),
  diplomaticNetwork: integer('diplomatic_network').default(0).notNull(),
  divineBlessing:    integer('divine_blessing').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const unitQueue = pgTable('unit_queue', {
  id:         uuid('id').primaryKey().defaultRandom(),
  kingdomId:  uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  unit:       varchar('unit', { length: 50 }).notNull(),
  amount:     integer('amount').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const researchQueue = pgTable('research_queue', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kingdomId:  uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  research:   varchar('research', { length: 50 }).notNull(),
  level:      integer('level').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const buildingQueue = pgTable('building_queue', {
  id:         uuid('id').primaryKey().defaultRandom(),
  kingdomId:  uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  building:   varchar('building', { length: 50 }).notNull(),
  level:      integer('level').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const lfBuildingQueue = pgTable('lf_building_queue', {
  id:         uuid('id').primaryKey().defaultRandom(),
  kingdomId:  uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  building:   varchar('building', { length: 60 }).notNull(),
  level:      integer('level').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const lfResearchQueue = pgTable('lf_research_queue', {
  id:         uuid('id').primaryKey().defaultRandom(),
  kingdomId:  uuid('kingdom_id').notNull().references(() => kingdoms.id, { onDelete: 'cascade' }),
  research:   varchar('research', { length: 60 }).notNull(),
  level:      integer('level').notNull(),
  startedAt:  integer('started_at').notNull(),
  finishesAt: integer('finishes_at').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
})

export const armyMissions = pgTable('army_missions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  holdingTime:   integer('holding_time').default(0).notNull(),
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
  ballistic:    integer('ballistic').default(0).notNull(),

  result:    text('result'),   // JSON string: battle outcome, spy report, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Debris fields ─────────────────────────────────────────────────────────────

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

// ── Messages ──────────────────────────────────────────────────────────────────

export const messages = pgTable('messages', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 20 }).notNull(),
  subject:   varchar('subject', { length: 255 }).notNull(),
  data:      text('data').notNull(),
  viewed:    boolean('viewed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Achievements ──────────────────────────────────────────────────────────────

export const userAchievements = pgTable('user_achievements', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: varchar('achievement_id', { length: 60 }).notNull(),
  unlockedAt:    timestamp('unlocked_at').defaultNow().notNull(),
  claimedAt:     timestamp('claimed_at'),
})

// ── Push subscriptions ────────────────────────────────────────────────────────

export const pushSubscriptions = pgTable('push_subscriptions', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint:  text('endpoint').notNull().unique(),
  p256dh:    text('p256dh').notNull(),
  auth:      text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Deterministic UUID for the system NPC user (no auth.users row backing it)
export const NPC_USER_ID = '00000000-0000-0000-0000-000000000001'

// ── Connection ────────────────────────────────────────────────────────────────

// prepare: false required for PgBouncer transaction pooling
const client = postgres(process.env.STORAGE_POSTGRES_URL, { prepare: false })
export const db = drizzle(client, { schema: { users, kingdoms, research, researchQueue, buildingQueue, lfBuildingQueue, lfResearchQueue, unitQueue, armyMissions, messages, debrisFields, settings, userAchievements, pushSubscriptions, etherTransactions, battleLog } })
