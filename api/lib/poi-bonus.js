/**
 * POI bonuses — calcula y carga el efecto permanente del POI reclamado por
 * cada kingdom. Se usa en tick.js, production.js, research, battle, etc.
 *
 * Forma del bonus devuelto:
 *   {
 *     wood:        0.15,    // +15% prod madera
 *     stone:       0.15,
 *     grain:       0.15,
 *     researchSpeed: 0.10,  // -10% tiempo research
 *     combatDef:   0.05,    // +5% atk/shield al defender
 *     ether:       { amount: 1, hours: 24 }  // periódico
 *   }
 * Cada campo es 0/null si no aplica.
 */
import { eq, inArray } from 'drizzle-orm'
import { db, pointsOfInterest } from '../_db.js'
import { POI_TYPES } from './poi.js'

const EMPTY_BONUS = Object.freeze({
  wood: 0, stone: 0, grain: 0,
  researchSpeed: 0,
  combatDef: 0,
  ether: null,
})

function bonusFromPoi(poi) {
  if (!poi) return EMPTY_BONUS
  const def = POI_TYPES[poi.type]
  if (!def?.permanent) return EMPTY_BONUS
  const p = def.permanent
  if (p.type === 'production' && p.resource && p.pct) {
    return { ...EMPTY_BONUS, [p.resource]: p.pct }
  }
  if (p.type === 'research_speed' && p.pct) {
    return { ...EMPTY_BONUS, researchSpeed: p.pct }
  }
  if (p.type === 'combat_def' && p.pct) {
    return { ...EMPTY_BONUS, combatDef: p.pct }
  }
  if (p.type === 'ether_periodic' && p.amount) {
    return { ...EMPTY_BONUS, ether: { amount: p.amount, hours: p.hours ?? 24 } }
  }
  return EMPTY_BONUS
}

/**
 * Carga el POI claimed por una kingdom y devuelve su bonus.
 * Si no tiene POI o está agotado, devuelve EMPTY_BONUS.
 */
export async function getPoiBonusForKingdom(kingdomId) {
  if (!kingdomId) return EMPTY_BONUS
  const [poi] = await db.select().from(pointsOfInterest)
    .where(eq(pointsOfInterest.claimedByKingdomId, kingdomId))
    .limit(1)
  return bonusFromPoi(poi)
}

/**
 * Bulk loader: dado un array de kingdom ids, devuelve un mapa { kingdomId: bonus }.
 * Usado en crons que procesan muchos kingdoms a la vez.
 */
export async function getPoiBonusesForKingdoms(kingdomIds) {
  const result = {}
  if (!kingdomIds || kingdomIds.length === 0) return result
  const pois = await db.select().from(pointsOfInterest)
    .where(inArray(pointsOfInterest.claimedByKingdomId, kingdomIds))
  for (const k of kingdomIds) result[k] = EMPTY_BONUS
  for (const poi of pois) {
    if (poi.claimedByKingdomId) result[poi.claimedByKingdomId] = bonusFromPoi(poi)
  }
  return result
}

export { EMPTY_BONUS }
