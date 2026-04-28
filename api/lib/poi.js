/**
 * Puntos de Interés (POI) — recursos especiales en slots vacíos del mapa.
 *
 * Generación: al inicio de temporada, ~30% de slots vacíos reciben un POI.
 * Tipo elegido por pesos. Seed determinista por coord para reproducibilidad.
 *
 * Visibilidad: privada por usuario (tabla poi_discoveries). Cada user solo ve
 * los POI a los que ha enviado expedición.
 *
 * Magnitud: cada POI inicia con 100. Cada expedición consume 15. Al llegar a 0,
 * el POI se agota y deja de ser explotable o reclamable.
 *
 * Claim: si un user coloniza un slot con POI activo, el POI queda "fijado" a
 * esa kingdom y otorga el bonus permanente correspondiente al tipo.
 */
import { db, pointsOfInterest } from '../_db.js'
import { UNIVERSE } from './config.js'

// ── Tipos de POI ─────────────────────────────────────────────────────────────
// weight: probabilidad relativa al elegir tipo (suma 100)
// expedition: forma del outcome al expedicionar (consume magnitud)
// permanent:  bonus permanente al claim por colonización
export const POI_TYPES = {
  yacimiento_madera: {
    weight: 30,
    label:  'Yacimiento de Madera',
    expedition: { resource: 'wood', multiplier: [2, 3] },        // outcome ×2-3 wood
    permanent:  { type: 'production', resource: 'wood',  pct: 0.15 },  // +15% prod wood en colonia
  },
  yacimiento_piedra: {
    weight: 25,
    label:  'Yacimiento de Piedra',
    expedition: { resource: 'stone', multiplier: [2, 3] },
    permanent:  { type: 'production', resource: 'stone', pct: 0.15 },
  },
  yacimiento_grano: {
    weight: 20,
    label:  'Yacimiento de Grano',
    expedition: { resource: 'grain', multiplier: [2, 3] },
    permanent:  { type: 'production', resource: 'grain', pct: 0.15 },
  },
  reliquia_arcana: {
    weight: 15,
    label:  'Reliquia Arcana',
    expedition: { ether: [1, 3] },                                // outcome 1-3 éter
    permanent:  { type: 'ether_periodic', amount: 1, hours: 24 }, // +1 éter cada 24h
  },
  ruinas_antiguas: {
    weight:  8,
    label:  'Ruinas Antiguas',
    expedition: { unitDrop: 'paladin', count: 1 },                // 1 paladín suelto
    permanent:  { type: 'research_speed', pct: 0.10 },            // -10% tiempo research en kingdom
  },
  templo_perdido: {
    weight:  2,
    label:  'Templo Perdido',
    expedition: { researchBonus: 1 },                             // +1 nivel efectivo a una research random
    permanent:  { type: 'combat_def', pct: 0.05 },                // +5% atk/shield al defender
  },
}

const POI_PROBABILITY = 0.30
const MAGNITUDE_INITIAL = 100
const MAGNITUDE_DECAY   = 15  // por expedición — agota en ~7 visitas

export { MAGNITUDE_INITIAL, MAGNITUDE_DECAY }

// ── Hash determinista por coord (Wang hash variante) ─────────────────────────
// Idéntica seed → idéntico POI. Reproducible entre sesiones de seeding.
function poiHash(realm, region, slot, salt = 0) {
  let h = (realm * 374761397 + region * 1234567 + slot * 7654321 + salt) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  h = Math.imul(h, 2246822507) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 3266489909) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h
}

function poiSeededRand(realm, region, slot) {
  let s = poiHash(realm, region, slot)
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    return (s >>> 1) / 0x7fffffff
  }
}

// Suma de pesos precalculada para weighted choice
const TOTAL_WEIGHT = Object.values(POI_TYPES).reduce((s, t) => s + t.weight, 0)

function pickPoiType(rand) {
  const roll = rand() * TOTAL_WEIGHT
  let cumulative = 0
  for (const [key, def] of Object.entries(POI_TYPES)) {
    cumulative += def.weight
    if (roll < cumulative) return key
  }
  return Object.keys(POI_TYPES)[0]  // fallback
}

/**
 * Genera POIs en slots vacíos. Usar al inicio de temporada Y para retro-fill.
 * @param {Set<string>} takenSlots — set de coords ocupadas ('realm:region:slot')
 * @returns {number} número de POIs creados
 */
export async function generatePoisForUniverse(takenSlots) {
  const { maxRealm, maxRegion, maxSlot } = UNIVERSE
  const pois = []

  for (let realm = 1; realm <= maxRealm; realm++) {
    for (let region = 1; region <= maxRegion; region++) {
      for (let slot = 1; slot <= maxSlot; slot++) {
        if (takenSlots.has(`${realm}:${region}:${slot}`)) continue

        const rand = poiSeededRand(realm, region, slot)
        rand()  // descartar primer valor (Wang hash conditioning)

        if (rand() >= POI_PROBABILITY) continue

        pois.push({
          realm, region, slot,
          type: pickPoiType(rand),
          magnitude: MAGNITUDE_INITIAL,
        })
      }
    }
  }

  if (pois.length === 0) return 0

  // Insertar en chunks (evitar parámetros gigantes en una sola query)
  const CHUNK = 500
  for (let i = 0; i < pois.length; i += CHUNK) {
    await db.insert(pointsOfInterest)
      .values(pois.slice(i, i + CHUNK))
      .onConflictDoNothing()  // idempotente: si ya existe ese slot, no falla
  }

  return pois.length
}
