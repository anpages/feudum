/**
 * Terrain system — deterministic by coordinates, no DB lookup needed.
 *
 * Distribution: forest 35%, mountain 35%, plains 25%, balanced 5%
 * Modifiers apply to production rates (base stored in DB stays untouched).
 */

export const TERRAIN_INFO = {
  forest:   { label: 'Bosque',      emoji: '🌲', bonus: 'Madera +25%',  wood: 1.25, stone: 0.90, grain: 1.00 },
  mountain: { label: 'Montaña',     emoji: '⛰️', bonus: 'Piedra +25%',  wood: 0.90, stone: 1.25, grain: 1.00 },
  plains:   { label: 'Llanura',     emoji: '🌾', bonus: 'Grano +25%',   wood: 1.00, stone: 0.90, grain: 1.25 },
  balanced: { label: 'Equilibrado', emoji: '⚖️', bonus: 'Todo +10%',    wood: 1.10, stone: 1.10, grain: 1.10 },
}

/**
 * Deterministic terrain from coordinates.
 * Uses the same formula as the SQL migration so they always agree.
 */
export function terrainForSlot(realm, region, slot) {
  const h = Math.abs((realm * 7901 + region * 97 + slot * 37 + realm * region * slot) % 100)
  if (h < 35) return 'forest'
  if (h < 70) return 'mountain'
  if (h < 95) return 'plains'
  return 'balanced'
}

/** Returns production multipliers for the given terrain type. */
export function terrainModifiers(terrain) {
  return TERRAIN_INFO[terrain] ?? TERRAIN_INFO.balanced
}

/**
 * Priority order for the NPC building AI per terrain.
 * First entry = highest priority production building to build first.
 */
export const NPC_BUILD_PRIORITY = {
  forest:   ['sawmill', 'quarry', 'grainFarm'],
  mountain: ['quarry', 'sawmill', 'grainFarm'],
  plains:   ['grainFarm', 'sawmill', 'quarry'],
  balanced: ['sawmill', 'grainFarm', 'quarry'],
}
