/**
 * Season boss pool — one boss per season, cycling and growing harder.
 * Each boss is a special NPC kingdom seeded at the center of the map.
 * Defeating it in battle = immediate season victory.
 */

export const BOSS_POOL = [
  {
    slug:       'malachar',
    name:       'Fortaleza de Malachar el Inmortal',
    difficulty: 1.0,
    lore:       'Un señor de la guerra que desafió a la muerte y perdió la humanidad en el proceso.',
  },
  {
    slug:       'vorgath',
    name:       'Ciudadela de Vorgath el Devastador',
    difficulty: 1.25,
    lore:       'Sus ejércitos arrasaron tres reinos antes de que nadie supiera su nombre.',
  },
  {
    slug:       'seraphel',
    name:       'Torre de Seraphel la Sombría',
    difficulty: 1.5,
    lore:       'Domina las artes oscuras y los secretos del Caballero Dragón.',
  },
  {
    slug:       'keldrath',
    name:       'Bastión de Keldrath el Eterno',
    difficulty: 1.75,
    lore:       'Lleva mil años forjando su ejército perfecto. Hoy llega tu turno de enfrentarlo.',
  },
  {
    slug:       'navareth',
    name:       'Ciudadela de Navareth la Implacable',
    difficulty: 2.0,
    lore:       'No negocia, no perdona, no olvida. Solo conquista.',
  },
  {
    slug:       'zharath',
    name:       'Fortaleza de Zharath el Devorador',
    difficulty: 2.25,
    lore:       'Se alimenta de los recursos de sus enemigos. Cuanto más tardas, más fuerte se vuelve.',
  },
  {
    slug:       'mordecai',
    name:       'Ciudadela de Mordecai el Despiadado',
    difficulty: 2.5,
    lore:       'El arquitecto del fin de los tiempos. Sus Caballeros Dragón cubren el cielo.',
  },
]

/** Return the boss definition for a given season number (cyclic, difficulty increases each cycle). */
export function getBossForSeason(seasonNumber) {
  const idx    = (seasonNumber - 1) % BOSS_POOL.length
  const cycles = Math.floor((seasonNumber - 1) / BOSS_POOL.length)
  const base   = BOSS_POOL[idx]
  const difficulty = base.difficulty * (1 + cycles * 0.25)
  return { ...base, difficulty, seasonNumber }
}

/**
 * Boss position: center of the universe (realm 2, middle region, middle slot).
 * With default UNIVERSE (3 realms × 10 regions × 15 slots) → R2·5·8.
 */
export function getBossPosition(universe) {
  return {
    realm:  Math.ceil(universe.maxRealm  / 2),
    region: Math.ceil(universe.maxRegion / 2),
    slot:   Math.ceil(universe.maxSlot   / 2),
  }
}
