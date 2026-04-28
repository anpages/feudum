/**
 * Retro-fill: genera Puntos de Interés en la temporada actual sin esperar al
 * próximo reset. Ejecutar UNA SOLA VEZ tras desplegar el sistema POI.
 *
 * Uso:
 *   set -a && source .env.local && set +a
 *   node scripts/seed_pois_current_season.mjs
 *
 * Idempotente: si los POIs ya existen, ON CONFLICT DO NOTHING evita duplicados.
 */
import '../api/lib/env.js'
import { db, kingdoms, pointsOfInterest } from '../api/_db.js'
import { generatePoisForUniverse } from '../api/lib/poi.js'

const existingCount = await db.$count(pointsOfInterest)
console.log(`POIs existentes en BD: ${existingCount}`)

const taken = await db.select({
  realm:  kingdoms.realm,
  region: kingdoms.region,
  slot:   kingdoms.slot,
}).from(kingdoms)

const takenSlots = new Set(taken.map(k => `${k.realm}:${k.region}:${k.slot}`))
console.log(`Slots ocupados (NPCs + jugadores): ${takenSlots.size}`)

const generated = await generatePoisForUniverse(takenSlots)
console.log(`POIs generados: ${generated}`)

const finalCount = await db.$count(pointsOfInterest)
console.log(`POIs en BD tras seed: ${finalCount}`)

// Distribución por tipo
const byType = await db.execute(`
  SELECT type, COUNT(*)::int AS count, AVG(magnitude)::int AS avg_mag
  FROM points_of_interest
  GROUP BY type
  ORDER BY count DESC
`)
console.log('\nDistribución por tipo:')
for (const r of byType) {
  console.log(`  ${r.type.padEnd(22)} ${String(r.count).padStart(4)}  avg mag ${r.avg_mag}`)
}

process.exit(0)
