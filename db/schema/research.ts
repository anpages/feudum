import { pgTable, serial, integer, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

// Equivalent to OGame's users_tech — per-player research tree
export const research = pgTable('research', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id).unique(),

  // ── Combat research ──────────────────────────────────────────
  swordsmanship: integer('swordsmanship').default(0).notNull(),   // weapon_technology
  armoury: integer('armoury').default(0).notNull(),               // shielding_technology
  fortification: integer('fortification').default(0).notNull(),   // armour_technology (implicit)

  // ── Logistics ────────────────────────────────────────────────
  horsemanship: integer('horsemanship').default(0).notNull(),     // combustion_drive
  cartography: integer('cartography').default(0).notNull(),       // impulse_drive
  tradeRoutes: integer('trade_routes').default(0).notNull(),      // hyperspace_drive

  // ── Mystical / Science ───────────────────────────────────────
  alchemy: integer('alchemy').default(0).notNull(),               // energy_technology
  pyromancy: integer('pyromancy').default(0).notNull(),           // laser_technology
  runemastery: integer('runemastery').default(0).notNull(),       // ion_technology
  mysticism: integer('mysticism').default(0).notNull(),           // hyperspace_technology
  dragonlore: integer('dragonlore').default(0).notNull(),         // plasma_technology

  // ── Intelligence & Expansion ─────────────────────────────────
  spycraft: integer('spycraft').default(0).notNull(),             // espionage_technology
  logistics: integer('logistics').default(0).notNull(),           // computer_technology
  exploration: integer('exploration').default(0).notNull(),       // astrophysics
  diplomaticNetwork: integer('diplomatic_network').default(0).notNull(), // intergalactic_research_network
  divineBlessing: integer('divine_blessing').default(0).notNull(), // graviton_technology

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Research = typeof research.$inferSelect
export type NewResearch = typeof research.$inferInsert
