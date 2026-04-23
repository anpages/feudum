export const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

export const DEFENSE_KEYS = [
  'archer','crossbowman','ballista','trebuchet',
  'mageTower','dragonCannon','palisade','castleWall','moat','catapult','beacon',
]

export const ALL_UNIT_KEYS = [...UNIT_KEYS, ...DEFENSE_KEYS]

// Extract units from an enriched kingdom row (building/unit maps merged in)
export function extractUnits(row, keys) {
  const out = {}
  for (const k of keys) out[k] = row[k] ?? 0
  return out
}

// Extract units from a mission row (JSONB units field)
export function extractMissionUnits(mission, keys) {
  const u = mission.units ?? {}
  if (!keys) return { ...u }
  const out = {}
  for (const k of keys) out[k] = u[k] ?? 0
  return out
}
