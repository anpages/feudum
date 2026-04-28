import { pgTable, integer, varchar, uuid, timestamp, primaryKey, foreignKey } from 'drizzle-orm/pg-core'
import { users } from './users'
import { kingdoms } from './kingdoms'

/**
 * Punto de Interés — recurso especial generado en un slot vacío del mapa.
 * Permanece oculto hasta que un jugador o NPC realiza una expedición allí.
 *
 * Mecánica:
 *   - Generados al inicio de temporada con seed determinista por coord (~30% slots vacíos)
 *   - Al expedicionar al slot, el usuario lo descubre (visibilidad privada por user)
 *   - Cada expedición consume `magnitude` (15 por visita; 100 inicial = ~7 expediciones)
 *   - Si se coloniza el slot mientras `magnitude > 0`, el POI se "fija" y otorga
 *     un bonus permanente a esa colonia (claimed_by_kingdom_id)
 *   - Si magnitud llega a 0 sin haber sido colonizado, queda inerte (slot normal)
 *
 * PK: (realm, region, slot) — un POI por slot máximo, no se duplica
 */
export const pointsOfInterest = pgTable('points_of_interest', {
  realm:  integer('realm').notNull(),
  region: integer('region').notNull(),
  slot:   integer('slot').notNull(),

  // Tipo del POI: 'yacimiento_madera', 'yacimiento_piedra', 'yacimiento_grano',
  // 'reliquia_arcana', 'ruinas_antiguas', 'templo_perdido'.
  type: varchar('type', { length: 40 }).notNull(),

  // Magnitud restante (0-100). Decrece con cada expedición; al llegar a 0 el POI
  // se agota y deja de ser explotable o reclamable.
  magnitude: integer('magnitude').notNull().default(100),

  // Si el slot se coloniza mientras magnitud > 0, esta kingdom recibe el bonus
  // permanente del POI durante el resto de la temporada.
  claimedByKingdomId: uuid('claimed_by_kingdom_id'),
  claimedAt:          timestamp('claimed_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.realm, t.region, t.slot] }),
  claimedFk: foreignKey({
    columns: [t.claimedByKingdomId],
    foreignColumns: [kingdoms.id],
  }).onDelete('set null'),
}))

/**
 * Visibilidad privada de los POI: un jugador solo ve los POI que él (o sus NPCs)
 * ha descubierto. Si dos usuarios expedicionan al mismo slot, ambos lo ven y
 * ambos contribuyen al consumo de magnitud — pero un tercer usuario sigue sin saber.
 */
export const poiDiscoveries = pgTable('poi_discoveries', {
  poiRealm:  integer('poi_realm').notNull(),
  poiRegion: integer('poi_region').notNull(),
  poiSlot:   integer('poi_slot').notNull(),
  userId:    uuid('user_id').notNull(),
  discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.poiRealm, t.poiRegion, t.poiSlot, t.userId] }),
  poiFk: foreignKey({
    columns: [t.poiRealm, t.poiRegion, t.poiSlot],
    foreignColumns: [pointsOfInterest.realm, pointsOfInterest.region, pointsOfInterest.slot],
  }).onDelete('cascade'),
  userFk: foreignKey({
    columns: [t.userId],
    foreignColumns: [users.id],
  }).onDelete('cascade'),
}))

export type PointOfInterest = typeof pointsOfInterest.$inferSelect
export type PoiDiscovery    = typeof poiDiscoveries.$inferSelect
