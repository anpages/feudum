/**
 * Expedition engine for Feudum.
 * Slot 16 = "Tierras Ignotas" — beyond the known map.
 *
 * Outcomes:
 *   nothing      35% — flota regresa vacía
 *   resources    25% — botín abandonado (madera/piedra/grano)
 *   units        15% — supervivientes que se unen
 *   delay        10% — caminos perdidos, regreso retrasado
 *   speedup       5% — viento favorable, regreso anticipado
 *   bandits       4% — merodeadores (débiles, tech -3)
 *   demons        3% — bestias oscuras (fuertes, tech +3)
 *   ether         2% — reliquias arcanas
 *   black_hole    1% — tormenta arcana, flota desaparece
 */

import { buildBattleUnits, runBattle, calcCargoCapacity } from './battle.js'

const OUTCOMES = [
  { id: 'nothing',    weight: 33 },
  { id: 'resources',  weight: 24 },
  { id: 'units',      weight: 14 },
  { id: 'delay',      weight: 10 },
  { id: 'speedup',    weight:  5 },
  { id: 'bandits',    weight:  4 },
  { id: 'demons',     weight:  3 },
  { id: 'merchant',   weight:  4 },
  { id: 'ether',      weight:  2 },
  { id: 'black_hole', weight:  1 },
]

const TOTAL_WEIGHT = OUTCOMES.reduce((s, o) => s + o.weight, 0)

// Unit cost proxy for fleet value (wood + stone)
const UNIT_VALUE = {
  squire:       4000,  knight:      10000, paladin:     27000,
  warlord:      60000, grandKnight: 70000, siegeMaster: 85000,
  warMachine:  200000, dragonKnight:1000000,
  merchant:     6000,  caravan:     20000, colonist:    10000,
  scavenger:   10000,  scout:        2000,
}

const COMBAT_UNITS = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']

function pickOutcome() {
  let r = Math.random() * TOTAL_WEIGHT
  for (const o of OUTCOMES) {
    r -= o.weight
    if (r <= 0) return o.id
  }
  return 'nothing'
}

function fleetValue(units) {
  let v = 0
  for (const [k, n] of Object.entries(units)) v += (UNIT_VALUE[k] ?? 0) * (n ?? 0)
  return v
}

// Combat tier: 89% normal, 10% large, 1% enormous
function combatTier() {
  const r = Math.random() * 100
  if (r < 89) return 1
  if (r < 99) return 2
  return 3
}

// Build enemy fleet as fraction of player fleet value
function buildEnemyFleet(playerUnits, type) {
  const tier = combatTier()
  const value = fleetValue(playerUnits)

  // Fraction of player fleet value
  const fractions = {
    bandits: [0.30, 0.50, 0.80],
    demons:  [0.60, 0.90, 1.30],
  }
  const fBase  = fractions[type][tier - 1]
  const fRange = fBase * 0.1
  const fraction = fBase + (Math.random() * 2 - 1) * fRange
  const targetValue = Math.max(1000, Math.round(value * fraction))

  // Composition per type/tier (main unit, secondary unit, value per unit)
  const compositions = {
    bandits: [
      { main: 'squire',  mainV: 4000,  sub: 'knight',   subV: 10000, mainRatio: 0.80 },
      { main: 'knight',  mainV: 10000, sub: 'paladin',  subV: 27000, mainRatio: 0.70 },
      { main: 'paladin', mainV: 27000, sub: 'warlord',  subV: 60000, mainRatio: 0.60 },
    ],
    demons: [
      { main: 'knight',   mainV: 10000, sub: 'paladin',     subV: 27000,  mainRatio: 0.70 },
      { main: 'paladin',  mainV: 27000, sub: 'warlord',     subV: 60000,  mainRatio: 0.65 },
      { main: 'warlord',  mainV: 60000, sub: 'grandKnight', subV: 70000,  mainRatio: 0.60 },
    ],
  }

  const comp = compositions[type][tier - 1]
  const mainCount = Math.max(1, Math.round((targetValue * comp.mainRatio) / comp.mainV))
  const subCount  = Math.max(0, Math.round((targetValue * (1 - comp.mainRatio)) / comp.subV))

  return { [comp.main]: mainCount, [comp.sub]: subCount }
}

// Tech modifier object for battle engine
function npcResearch(playerResearch, techDelta) {
  const fields = ['swordsmanship', 'armoury', 'fortification']
  const out = {}
  for (const f of fields) {
    out[f] = Math.max(0, (playerResearch?.[f] ?? 0) + techDelta)
  }
  return out
}

// Resources found: up to 60% of cargo capacity, random mix
function resourcesFound(units) {
  const cargo = calcCargoCapacity(units)
  if (cargo === 0) return { wood: 0, stone: 0, grain: 0 }

  const total = Math.floor(cargo * (0.2 + Math.random() * 0.4))
  const woodShare  = 0.5 + Math.random() * 0.3
  const stoneShare = (1 - woodShare) * (0.6 + Math.random() * 0.3)
  const grainShare = 1 - woodShare - stoneShare

  return {
    wood:  Math.floor(total * woodShare),
    stone: Math.floor(total * stoneShare),
    grain: Math.floor(total * grainShare),
  }
}

// Units found: 10-20% of the sent fleet's combat units, one random type
function unitsFound(sentUnits) {
  const available = COMBAT_UNITS.filter(k => (sentUnits[k] ?? 0) > 0)
  if (available.length === 0) {
    // At least squires if no combat units sent
    return { squire: Math.max(1, Math.floor(2 + Math.random() * 5)) }
  }
  const type  = available[Math.floor(Math.random() * available.length)]
  const count = Math.max(1, Math.floor((sentUnits[type] ?? 1) * (0.10 + Math.random() * 0.10)))
  return { [type]: count }
}

// Ether amount: 5–50
function etherFound() {
  return Math.floor(5 + Math.random() * 46)
}

// Merchant offer: trade one resource for another at favorable rates
// Player gives one resource, receives a different one at 1.3–2.0× ratio
function generateMerchantOffer(sentUnits, now) {
  const cargo = calcCargoCapacity(sentUnits)
  const base  = Math.max(2000, Math.floor(cargo * (0.12 + Math.random() * 0.15)))

  const res  = ['wood', 'stone', 'grain']
  const gi   = Math.floor(Math.random() * 3)
  const ri   = (gi + 1 + Math.floor(Math.random() * 2)) % 3

  const giveAmt    = base
  const ratio      = 1.3 + Math.random() * 0.7   // 1.3–2.0× favorable
  const receiveAmt = Math.floor(giveAmt * ratio)

  return {
    give:      { [res[gi]]: giveAmt },
    receive:   { [res[ri]]: receiveAmt },
    expiresAt: now + 24 * 3600,   // 24h to respond
  }
}

// Delay multipliers: 89% ×2, 10% ×3, 1% ×5
function delayMultiplier() {
  const r = Math.random() * 100
  if (r < 89) return 2
  if (r < 99) return 3
  return 5
}

// Speedup: reduce return time by 5-10%
function speedupFraction() {
  return 0.05 + Math.random() * 0.05
}

/**
 * Resolve expedition outcome.
 * Returns { outcome, result, unitPatch, returnTimeDelta, etherGained, merchantOffer? }
 *
 * unitPatch: units to set on the mission row on return (null = no change)
 * returnTimeDelta: seconds to add to returnTime (positive = delay, negative = speedup)
 * etherGained: ether to credit to player
 * merchantOffer: present only when outcome === 'merchant'
 */
export function resolveExpedition(sentUnits, playerResearch, travelSecs, now) {
  const outcome = pickOutcome()

  switch (outcome) {
    case 'nothing':
      return { outcome, result: { type: 'nothing' }, unitPatch: null, returnTimeDelta: 0, etherGained: 0 }

    case 'resources': {
      const found = resourcesFound(sentUnits)
      return { outcome, result: { type: 'resources', found }, unitPatch: null, returnTimeDelta: 0, etherGained: 0 }
    }

    case 'units': {
      const found = unitsFound(sentUnits)
      return { outcome, result: { type: 'units', found }, unitPatch: found, returnTimeDelta: 0, etherGained: 0 }
    }

    case 'delay': {
      const mult = delayMultiplier()
      const delta = travelSecs * (mult - 1)
      return { outcome, result: { type: 'delay', multiplier: mult }, unitPatch: null, returnTimeDelta: delta, etherGained: 0 }
    }

    case 'speedup': {
      const frac = speedupFraction()
      const delta = -Math.floor(travelSecs * frac)
      return { outcome, result: { type: 'speedup', fraction: frac }, unitPatch: null, returnTimeDelta: delta, etherGained: 0 }
    }

    case 'bandits':
    case 'demons': {
      const npcUnits    = buildEnemyFleet(sentUnits, outcome)
      const techDelta   = outcome === 'bandits' ? -3 : 3
      const atkUnits    = buildBattleUnits(sentUnits, playerResearch ?? {})
      const defUnits    = buildBattleUnits(npcUnits,  npcResearch(playerResearch, techDelta))
      const { outcome: battleOutcome, survivingAtk, lostAtk, lostDef } = runBattle(atkUnits, defUnits)

      // Apply battle losses to sent units
      const unitPatch = {}
      for (const k of Object.keys(sentUnits)) {
        unitPatch[k] = Math.max(0, (sentUnits[k] ?? 0) - (lostAtk[k] ?? 0))
      }

      // If player loses (or draw), all units destroyed — no return
      const playerWins = battleOutcome === 'victory'

      return {
        outcome,
        result: {
          type: outcome,
          battleOutcome,
          npcFleet: npcUnits,
          lostAtk, lostDef,
          survivingAtk,
        },
        unitPatch: playerWins ? unitPatch : null,
        returnTimeDelta: 0,
        etherGained: 0,
        destroyed: !playerWins,
      }
    }

    case 'ether': {
      const amount = etherFound()
      return { outcome, result: { type: 'ether', amount }, unitPatch: null, returnTimeDelta: 0, etherGained: amount }
    }

    case 'merchant': {
      const merchantOffer = generateMerchantOffer(sentUnits, now)
      return {
        outcome,
        result: { type: 'expedition', outcome: 'merchant', merchantOffer },
        unitPatch: null,
        returnTimeDelta: 0,
        etherGained: 0,
        merchantOffer,
      }
    }

    case 'black_hole':
      return { outcome, result: { type: 'black_hole' }, unitPatch: null, returnTimeDelta: 0, etherGained: 0, destroyed: true }

    default:
      return { outcome: 'nothing', result: { type: 'nothing' }, unitPatch: null, returnTimeDelta: 0, etherGained: 0 }
  }
}
