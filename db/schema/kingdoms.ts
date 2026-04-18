import { pgTable, serial, integer, varchar, real, timestamp, boolean } from 'drizzle-orm/pg-core'
import { users } from './users'

// Equivalent to OGame's "planets" table — adapted to medieval theme
// Resources: wood (metal), stone (crystal), grain (deuterium)
export const kingdoms = pgTable('kingdoms', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 100 }).notNull(),

  // Map position (realm > region > slot)
  realm: integer('realm').notNull(),
  region: integer('region').notNull(),
  slot: integer('slot').notNull(),

  // Resources (stored as floats for partial accumulation between ticks)
  wood: real('wood').default(500).notNull(),
  woodProduction: real('wood_production').default(0).notNull(),
  woodCapacity: real('wood_capacity').default(10000).notNull(),
  stone: real('stone').default(500).notNull(),
  stoneProduction: real('stone_production').default(0).notNull(),
  stoneCapacity: real('stone_capacity').default(10000).notNull(),
  grain: real('grain').default(500).notNull(),
  grainProduction: real('grain_production').default(0).notNull(),
  grainCapacity: real('grain_capacity').default(10000).notNull(),
  populationUsed: integer('population_used').default(0).notNull(),
  populationMax: integer('population_max').default(0).notNull(),
  lastResourceUpdate: integer('last_resource_update').default(0).notNull(),

  // ── Buildings ────────────────────────────────────────────────
  // Production
  sawmill: integer('sawmill').default(0).notNull(),             // metal_mine
  quarry: integer('quarry').default(0).notNull(),               // crystal_mine
  grainFarm: integer('grain_farm').default(0).notNull(),        // deuterium_synthesizer
  windmill: integer('windmill').default(0).notNull(),           // solar_plant
  cathedral: integer('cathedral').default(0).notNull(),         // fusion_plant

  // Infrastructure
  workshop: integer('workshop').default(0).notNull(),           // robot_factory
  engineersGuild: integer('engineers_guild').default(0).notNull(), // nano_factory
  barracks: integer('barracks').default(0).notNull(),           // shipyard
  granary: integer('granary').default(0).notNull(),             // metal_store
  stonehouse: integer('stonehouse').default(0).notNull(),       // crystal_store
  silo: integer('silo').default(0).notNull(),                   // deuterium_store
  academy: integer('academy').default(0).notNull(),             // research_lab
  alchemistTower: integer('alchemist_tower').default(0).notNull(), // terraformer
  ambassadorHall: integer('ambassador_hall').default(0).notNull(), // alliance_depot
  armoury: integer('armoury').default(0).notNull(),             // missile_silo

  // ── Military units ───────────────────────────────────────────
  // Combat
  squire: integer('squire').default(0).notNull(),               // light_fighter
  knight: integer('knight').default(0).notNull(),               // heavy_fighter
  paladin: integer('paladin').default(0).notNull(),             // cruiser
  warlord: integer('warlord').default(0).notNull(),             // battle_ship
  grandKnight: integer('grand_knight').default(0).notNull(),    // battlecruiser
  siegeMaster: integer('siege_master').default(0).notNull(),    // bomber
  warMachine: integer('war_machine').default(0).notNull(),      // destroyer
  dragonKnight: integer('dragon_knight').default(0).notNull(), // deathstar

  // Support
  merchant: integer('merchant').default(0).notNull(),          // small_cargo
  caravan: integer('caravan').default(0).notNull(),             // large_cargo
  colonist: integer('colonist').default(0).notNull(),           // colony_ship
  scavenger: integer('scavenger').default(0).notNull(),         // recycler
  scout: integer('scout').default(0).notNull(),                 // espionage_probe
  beacon: integer('beacon').default(0).notNull(),               // solar_satellite

  // ── Defenses ─────────────────────────────────────────────────
  archer: integer('archer').default(0).notNull(),               // rocket_launcher
  crossbowman: integer('crossbowman').default(0).notNull(),     // light_laser
  ballista: integer('ballista').default(0).notNull(),           // heavy_laser
  trebuchet: integer('trebuchet').default(0).notNull(),         // gauss_cannon
  mageTower: integer('mage_tower').default(0).notNull(),        // ion_cannon
  dragonCannon: integer('dragon_cannon').default(0).notNull(),  // plasma_turret
  palisade: integer('palisade').default(0).notNull(),           // small_shield_dome
  castleWall: integer('castle_wall').default(0).notNull(),      // large_shield_dome
  moat: integer('moat').default(0).notNull(),                   // anti_ballistic_missile
  catapult: integer('catapult').default(0).notNull(),           // interplanetary_missile

  // ── Terrain ──────────────────────────────────────────────────
  terrain: varchar('terrain', { length: 20 }).default('balanced').notNull(), // forest|mountain|plains|balanced

  // ── NPC flags ────────────────────────────────────────────────
  isNpc: boolean('is_npc').default(false).notNull(),
  npcLevel: integer('npc_level').default(0).notNull(), // 0=human, 1=weak, 2=medium, 3=strong

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Kingdom = typeof kingdoms.$inferSelect
export type NewKingdom = typeof kingdoms.$inferInsert
