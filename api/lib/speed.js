/**
 * Travel distance and duration formulas — derived from OGameX FleetMissionService.php
 *
 * Distance:
 *   diff realm  → 20000 × |r1 - r2|
 *   diff region → |rg1 - rg2| × 5 × 19 + 2700
 *   diff slot   → |s1 - s2| × 5 + 1000
 *   same pos    → 5
 *
 * Duration (seconds):
 *   (35000 / speedPct × sqrt(distance × 10 / slowestSpeed) + 10) / universeSpeed
 */

export const UNIT_SPEEDS = {
  squire:      12500,
  knight:      10000,
  paladin:     15000,
  warlord:     10000,
  grandKnight: 10000,
  siegeMaster:  4000,
  warMachine:   5000,
  dragonKnight:  100,
  merchant:     5000,
  caravan:      7500,
  colonist:     2500,
  scavenger:    2000,
  scout:    100000000,
}

// Max resource cargo per unit
export const UNIT_CAPACITY = {
  merchant:  5000,
  caravan:  25000,
  colonist:  7500,
  scavenger: 20000,
}

// Combat stats for simple battle resolution (same as units.js but keyed here too)
export const UNIT_ATTACK = {
  squire:       50,  knight:     150, paladin:     400,
  warlord:    1000,  grandKnight: 700, siegeMaster: 1000,
  warMachine: 2000,  dragonKnight: 200000,
  merchant:      5,  caravan:      5, colonist:      50,
  scavenger:     1,  scout:         0,
}

export function calcDistance(from, to) {
  const { realm: r1, region: rg1, slot: s1 } = from
  const { realm: r2, region: rg2, slot: s2 } = to
  if (r1 !== r2)   return 20000 * Math.abs(r1 - r2)
  if (rg1 !== rg2) return Math.abs(rg1 - rg2) * 5 * 19 + 2700
  if (s1 !== s2)   return Math.abs(s1 - s2) * 5 + 1000
  return 5
}

/**
 * @param {number} distance
 * @param {Object} units — { squire: 5, knight: 2, ... } only positive values
 * @param {number} speedPct — 100 = full speed
 * @param {number} universeSpeed — server speed multiplier
 * @param {Object} research — { horsemanship, cartography } levels
 * @returns {number} travel time in seconds
 */
export function calcDuration(distance, units, speedPct = 100, universeSpeed = 1, research = {}) {
  const horseLv = research.horsemanship ?? 0
  const cartoLv = research.cartography  ?? 0
  // horsemanship: +10%/level (combustion_drive), cartography: +20%/level (impulse_drive)
  const researchMultiplier = 1 + horseLv * 0.10 + cartoLv * 0.20

  const speeds = Object.entries(units)
    .filter(([, n]) => n > 0)
    .map(([id]) => (UNIT_SPEEDS[id] ?? 10000) * researchMultiplier)
  if (speeds.length === 0) return 0
  const slowest = Math.min(...speeds)
  return Math.max(1, Math.round(
    (35000 / speedPct * Math.sqrt((distance * 10) / slowest) + 10) / universeSpeed
  ))
}

export function calcCargoCapacity(units) {
  return Object.entries(units)
    .filter(([, n]) => n > 0)
    .reduce((sum, [id, n]) => sum + (UNIT_CAPACITY[id] ?? 0) * n, 0)
}

export function calcTotalAttack(units) {
  return Object.entries(units)
    .filter(([, n]) => n > 0)
    .reduce((sum, [id, n]) => sum + (UNIT_ATTACK[id] ?? 0) * n, 0)
}
