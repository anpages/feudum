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
 *   max(1, round((35000 / speedPct × sqrt(distance × 10 / slowestSpeed) + 10) / universeSpeed))
 *   speedPct: 10–100 (player choice), universeSpeed: server multiplier
 *
 * Speed per unit (mirrors OGame SpeedPropertyService):
 *   Each unit has a primary drive (horsemanship / cartography / tradeRoutes).
 *   Speed = base × (1 + driveLevel × bonusPct)
 *   Some units "upgrade" drive+base when a drive reaches a threshold (last match wins).
 *
 * Drive bonus per level:
 *   horsemanship (combustion_drive) → +10 % / level
 *   cartography  (impulse_drive)    → +20 % / level
 *   tradeRoutes  (hyperspace_drive) → +30 % / level
 */

export const DRIVE_BONUS = {
  horsemanship: 0.10,
  cartography:  0.20,
  tradeRoutes:  0.30,
}

/**
 * Per-unit drive config.
 * upgrades[]: applied in order; last matching upgrade wins.
 *   trigger: research key that must reach `level`
 *   base:    new base speed (replaces original)
 *   drive:   new drive to use for bonus calculation
 */
export const UNIT_DRIVES = {
  // combat units
  squire:       { drive: 'horsemanship', base: 12500 },
  knight:       { drive: 'cartography',  base: 10000 },
  paladin:      { drive: 'cartography',  base: 15000 },
  warlord:      { drive: 'tradeRoutes',  base: 10000 },
  grandKnight:  { drive: 'tradeRoutes',  base: 10000 },
  siegeMaster:  { drive: 'cartography',  base:  4000, upgrades: [
    { trigger: 'tradeRoutes', level:  8, base: 5000, drive: 'tradeRoutes' },
  ]},
  warMachine:   { drive: 'tradeRoutes',  base:  5000 },
  dragonKnight: { drive: 'tradeRoutes',  base:   100 },
  // civil units
  merchant:     { drive: 'horsemanship', base:  5000, upgrades: [
    { trigger: 'cartography', level:  5, base: 10000, drive: 'cartography' },
  ]},
  caravan:      { drive: 'horsemanship', base:  7500 },
  colonist:     { drive: 'cartography',  base:  2500 },
  scavenger:    { drive: 'horsemanship', base:  2000, upgrades: [
    { trigger: 'cartography', level: 17, base: 4000, drive: 'cartography' },
    { trigger: 'tradeRoutes', level: 15, base: 6000, drive: 'tradeRoutes' },
  ]},
  scout:        { drive: 'horsemanship', base: 100000000 },
  ballistic:    { drive: 'horsemanship', base:   5000 },
}

// Kept for backward compat (expedition.js fleetValue, battle helpers)
export const UNIT_SPEEDS = Object.fromEntries(
  Object.entries(UNIT_DRIVES).map(([k, v]) => [k, v.base])
)

// Max resource cargo per unit (combat units from OGame ref: capacity param in GameObjectProperties)
export const UNIT_CAPACITY = {
  squire:       50,
  knight:      100,
  paladin:     800,
  warlord:    1500,
  grandKnight:  750,
  siegeMaster:  500,
  warMachine:  2000,
  dragonKnight: 1_000_000,
  merchant:    5000,
  caravan:    25000,
  colonist:    7500,
  scavenger:  20000,
}

// Combat stats for simple battle resolution
export const UNIT_ATTACK = {
  squire:       50,  knight:     150, paladin:     400,
  warlord:    1000,  grandKnight: 700, siegeMaster: 1000,
  warMachine: 2000,  dragonKnight: 200000,
  merchant:      5,  caravan:      5, colonist:      50,
  scavenger:     1,  scout:         0,
}

/**
 * Returns the effective speed of a unit given current research levels.
 * Applies drive upgrades (last matching wins) then adds the drive bonus.
 */
export function getUnitSpeed(unitId, research = {}) {
  const config = UNIT_DRIVES[unitId]
  if (!config) return 10000
  let { drive, base } = config
  if (config.upgrades) {
    for (const u of config.upgrades) {
      if ((research[u.trigger] ?? 0) >= u.level) {
        drive = u.drive
        base  = u.base
      }
    }
  }
  const driveLv = research[drive] ?? 0
  return base * (1 + driveLv * (DRIVE_BONUS[drive] ?? 0))
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
 * @param {Object} units         — { squire: 5, ... } only positive values
 * @param {number} speedPct      — 10–100 (player choice, 100 = max speed)
 * @param {number} universeSpeed — server speed multiplier
 * @param {Object} research      — { horsemanship, cartography, tradeRoutes, ... } levels
 * @param {string|null} characterClass — 'general' gives +25% combat unit speed
 * @returns {number} travel time in seconds
 */
export function calcDuration(distance, units, speedPct = 100, universeSpeed = 1, research = {}, characterClass = null, lfSpeedBonus = 0) {
  const COMBAT_UNITS = new Set(['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight'])
  const speedMult = 1 + lfSpeedBonus

  const speeds = Object.entries(units)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([id]) => {
      const speed = getUnitSpeed(id, research)
      const classBonus = (characterClass === 'general' && COMBAT_UNITS.has(id)) ? 1.25 : 1.0
      return speed * classBonus * speedMult
    })

  if (speeds.length === 0) return 0
  const slowest = Math.min(...speeds)
  return Math.max(1, Math.round(
    (35000 / speedPct * Math.sqrt((distance * 10) / slowest) + 10) / universeSpeed
  ))
}

export function calcCargoCapacity(units) {
  return Object.entries(units)
    .filter(([, n]) => (n ?? 0) > 0)
    .reduce((sum, [id, n]) => sum + (UNIT_CAPACITY[id] ?? 0) * n, 0)
}

export function calcTotalAttack(units) {
  return Object.entries(units)
    .filter(([, n]) => (n ?? 0) > 0)
    .reduce((sum, [id, n]) => sum + (UNIT_ATTACK[id] ?? 0) * n, 0)
}
