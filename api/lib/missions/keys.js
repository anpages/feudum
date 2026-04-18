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

export function extractUnits(row, keys) {
  const out = {}
  for (const k of keys) out[k] = row[k] ?? 0
  return out
}
