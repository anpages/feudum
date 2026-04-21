import { pgTable, uuid, integer, varchar, real, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'

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

  // Buildings
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

  // Combat units
  squire:       integer('squire').default(0).notNull(),
  knight:       integer('knight').default(0).notNull(),
  paladin:      integer('paladin').default(0).notNull(),
  warlord:      integer('warlord').default(0).notNull(),
  grandKnight:  integer('grand_knight').default(0).notNull(),
  siegeMaster:  integer('siege_master').default(0).notNull(),
  warMachine:   integer('war_machine').default(0).notNull(),
  dragonKnight: integer('dragon_knight').default(0).notNull(),

  // Support units
  merchant:  integer('merchant').default(0).notNull(),
  caravan:   integer('caravan').default(0).notNull(),
  colonist:  integer('colonist').default(0).notNull(),
  scavenger: integer('scavenger').default(0).notNull(),
  scout:     integer('scout').default(0).notNull(),
  beacon:    integer('beacon').default(0).notNull(),

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

  isNpc:               boolean('is_npc').default(false).notNull(),
  isBoss:              boolean('is_boss').default(false).notNull(),
  npcLevel:            integer('npc_level').default(0).notNull(),
  npcBuildAvailableAt: integer('npc_build_available_at').default(0),
  npcLastBuildAt:      integer('npc_last_build_at').default(0).notNull(),
  npcLastAttackAt:     integer('npc_last_attack_at').default(0).notNull(),

  // Civilization (Formas de Vida)
  civilization:         varchar('civilization', { length: 20 }),  // 'romans'|'vikings'|'byzantines'|'saracens'|null
  civLevelRomans:       integer('civ_level_romans').default(0).notNull(),
  civLevelVikings:      integer('civ_level_vikings').default(0).notNull(),
  civLevelByzantines:   integer('civ_level_byzantines').default(0).notNull(),
  civLevelSaracens:     integer('civ_level_saracens').default(0).notNull(),
  populationT1:         real('population_t1').default(0).notNull(),
  populationT2:         real('population_t2').default(0).notNull(),
  populationT3:         real('population_t3').default(0).notNull(),
  foodStored:           real('food_stored').default(0).notNull(),
  foodLastUpdate:       integer('food_last_update').default(0).notNull(),
  artifacts:            integer('artifacts').default(0).notNull(),
  lfBuildings:          jsonb('lf_buildings').default({}).notNull(),
  lfResearch:           jsonb('lf_research').default({}).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Kingdom    = typeof kingdoms.$inferSelect
export type NewKingdom = typeof kingdoms.$inferInsert
