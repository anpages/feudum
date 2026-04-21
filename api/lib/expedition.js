/**
 * Expedition engine for Feudum.
 * Slot 16 = "Tierras Ignotas" — beyond the known map.
 *
 * Weights mirror OGame reference (ExpeditionMission.php):
 *   nothing      25   — flota regresa vacía
 *   resources    35   — botín abandonado (madera/piedra/grano)
 *   units        17   — supervivientes que se unen
 *   ether         7.5 — reliquias arcanas (≈ dark matter)
 *   delay         7.5 — caminos perdidos, regreso retrasado
 *   speedup       2.75— viento favorable, regreso anticipado
 *   bandits       3   — merodeadores (débiles, tech -3)
 *   demons        1.5 — bestias oscuras (fuertes, tech +3)
 *   merchant      0.4 — mercader errante
 *   black_hole    0.2 — tormenta arcana, flota desaparece
 */

import { buildBattleUnits, runBattle, calcCargoCapacity } from './battle.js'

const BASE_OUTCOMES = [
  { id: 'nothing',    weight: 25   },
  { id: 'resources',  weight: 35   },
  { id: 'units',      weight: 17   },
  { id: 'ether',      weight:  7.5 },
  { id: 'delay',      weight:  7.5 },
  { id: 'speedup',    weight:  2.75},
  { id: 'bandits',    weight:  3   },
  { id: 'demons',     weight:  1.5 },
  { id: 'merchant',   weight:  0.4 },
  { id: 'black_hole', weight:  0.2 },
]

// Unit cost proxy for fleet value (wood + stone)
const UNIT_VALUE = {
  squire:       4000,  knight:      10000, paladin:     27000,
  warlord:      60000, grandKnight: 70000, siegeMaster: 85000,
  warMachine:  200000, dragonKnight:1000000,
  merchant:     6000,  caravan:     20000, colonist:    10000,
  scavenger:   10000,  scout:        2000,
}

const COMBAT_UNITS = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']

// combatMultiplier: 0.5 for Discoverer class, 1.0 otherwise
function pickOutcome(combatMultiplier = 1.0) {
  const outcomes = BASE_OUTCOMES.map(o =>
    (o.id === 'bandits' || o.id === 'demons')
      ? { ...o, weight: o.weight * combatMultiplier }
      : o
  )
  const total = outcomes.reduce((s, o) => s + o.weight, 0)
  let r = Math.random() * total
  for (const o of outcomes) {
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

// Max resources by top-1 player points (mirrors OGame ref highscore tiers)
function maxResourcesByPoints(top1Points) {
  if      (top1Points <     10000) return   40000
  else if (top1Points <    100000) return  500000
  else if (top1Points <   1000000) return 1200000
  else if (top1Points <   5000000) return 1800000
  else if (top1Points <  25000000) return 2400000
  else if (top1Points <  50000000) return 3000000
  else if (top1Points <  75000000) return 3600000
  else if (top1Points < 100000000) return 4200000
  else                              return 5000000
}

// Resources found: scaled by top-1 player points, capped by cargo capacity
// top1Points: points of the top-ranked player (from rankings query)
function resourcesFound(units, top1Points = 0) {
  const cargo  = calcCargoCapacity(units)
  const maxTier = maxResourcesByPoints(top1Points)
  const minTier = Math.max(1, Math.floor(maxTier * 0.1))
  const base   = minTier + Math.floor(Math.random() * (maxTier - minTier + 1))

  // OGame distribution: wood 100%, stone 66%, grain 33% of base
  const rng = Math.floor(Math.random() * 3)
  let wood = 0, stone = 0, grain = 0
  if (rng === 0)      wood  = Math.min(cargo, base)
  else if (rng === 1) stone = Math.min(cargo, Math.floor(base * 2 / 3))
  else                grain = Math.min(cargo, Math.floor(base / 3))

  return { wood, stone, grain }
}

// Tier hierarchy: units discoverable = one tier above the highest tier sent
// tier 1: squire, knight  |  tier 2: paladin, warlord  |  tier 3: grandKnight, siegeMaster  |  tier 4: warMachine, dragonKnight
const UNIT_TIERS = [
  ['squire', 'knight'],
  ['paladin', 'warlord'],
  ['grandKnight', 'siegeMaster'],
  ['warMachine', 'dragonKnight'],
]

function unitTier(unitId) {
  return UNIT_TIERS.findIndex(t => t.includes(unitId))
}

// Units found: tier one above highest sent, or same tier if already at max
function unitsFound(sentUnits) {
  const sentTiers = COMBAT_UNITS.filter(k => (sentUnits[k] ?? 0) > 0).map(unitTier)
  if (sentTiers.length === 0) {
    return { squire: Math.max(1, 2 + Math.floor(Math.random() * 5)) }
  }
  const maxSentTier = Math.max(...sentTiers)
  const discoverTier = Math.min(maxSentTier + 1, UNIT_TIERS.length - 1)
  const pool = UNIT_TIERS[discoverTier]
  const type = pool[Math.floor(Math.random() * pool.length)]

  // Count based on value ratio: find similar-value count vs what was sent
  const refUnit = COMBAT_UNITS.find(k => unitTier(k) === maxSentTier && (sentUnits[k] ?? 0) > 0) ?? 'squire'
  const refValue  = (UNIT_VALUE[refUnit]  ?? 1000) * (sentUnits[refUnit] ?? 1)
  const typeValue = (UNIT_VALUE[type] ?? 1000)
  const ratio = 0.10 + Math.random() * 0.10
  const count = Math.max(1, Math.floor(refValue * ratio / typeValue))
  return { [type]: count }
}

// Ether amount: 150–400 (mirrors OGame dark matter range)
function etherFound() {
  return 150 + Math.floor(Math.random() * 251)
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
// opts.top1Points: points of top-ranked player (for resource scaling)
// opts.combatMultiplier: 0.5 for Discoverer class, 1.0 otherwise
// opts.holdingTime: seconds spent at expedition target (chosen by player)
// opts.discoverer: true if player has Discoverer class (resource/unit +50%)
export function resolveExpedition(sentUnits, playerResearch, travelSecs, now, opts = {}) {
  const { top1Points = 0, combatMultiplier = 1.0, holdingTime = 0, discoverer = false } = opts
  const outcome = pickOutcome(combatMultiplier)

  switch (outcome) {
    case 'nothing':
      return { outcome, result: { type: 'nothing' }, unitPatch: null, returnTimeDelta: 0, etherGained: 0 }

    case 'resources': {
      const found = resourcesFound(sentUnits, top1Points)
      // Discoverer class: +50% resources found (mirrors OGame characterClass multiplier)
      if (discoverer) {
        found.wood  = Math.floor((found.wood  ?? 0) * 1.5)
        found.stone = Math.floor((found.stone ?? 0) * 1.5)
        found.grain = Math.floor((found.grain ?? 0) * 1.5)
      }
      return { outcome, result: { type: 'resources', found }, unitPatch: null, returnTimeDelta: 0, etherGained: 0 }
    }

    case 'units': {
      const found = unitsFound(sentUnits)
      // Discoverer class: +50% units found
      if (discoverer) {
        for (const k of Object.keys(found)) found[k] = Math.max(1, Math.floor(found[k] * 1.5))
      }
      return { outcome, result: { type: 'units', found }, unitPatch: found, returnTimeDelta: 0, etherGained: 0 }
    }

    case 'delay': {
      // OGame formula: delay = holdingTime × multiplier (time spent at destination is multiplied)
      const mult = delayMultiplier()
      const base = holdingTime > 0 ? holdingTime : travelSecs
      const delta = base * (mult - 1)
      return { outcome, result: { type: 'delay', multiplier: mult }, unitPatch: null, returnTimeDelta: delta, etherGained: 0 }
    }

    case 'speedup': {
      // OGame formula: speedup = (travelSecs + holdingTime) × fraction
      const frac = speedupFraction()
      const onewayDuration = travelSecs + holdingTime
      const delta = -Math.floor(onewayDuration * frac)
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
