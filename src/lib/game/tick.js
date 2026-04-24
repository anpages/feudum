import {
  windmillEnergy, cathedralEnergy,
  sawmillEnergy, quarryEnergy, grainFarmEnergy,
} from './buildings.js'

/**
 * Compute ticked resources without writing to DB.
 * Applies basic income, energy balance, mine throttle, dragonlore and class bonus —
 * same formula as effectiveProduction() in src/lib/game/production.js. Both must
 * stay in lock-step: divergence causes client "afford" ≠ server check, so buttons
 * look clickable but the mutation 400s silently.
 * @param {string|null} characterClass — collector gets +25% production
 * @param {Object|null} res — research row (for alchemy + dragonlore)
 */
export function applyResourceTick(kingdom, cfg, characterClass = null, res = null) {
  const now     = Math.floor(Date.now() / 1000)
  const elapsed = Math.max(0, now - kingdom.lastResourceUpdate) / 3600
  const speed      = cfg?.economy_speed ?? 1
  const basicWood  = cfg?.basic_wood  ?? 0
  const basicStone = cfg?.basic_stone ?? 0

  if (elapsed <= 0) {
    return { wood: kingdom.wood, stone: kingdom.stone, grain: kingdom.grain, now }
  }

  const alchLv          = res?.alchemy    ?? 0
  const dl              = res?.dragonlore ?? 0
  const classBonus      = characterClass === 'collector' ? 1.25 : 1.0
  // Collector: +10% energy production (OGame: getEnergyProductionBonus)
  const energyClassBonus = characterClass === 'collector' ? 1.10 : 1.0

  // Support both flat keys (from kingdomService) and nested productionSettings (from DB row)
  const ps = kingdom.productionSettings ?? {}
  const sawPct   = ((kingdom.sawmillPercent    ?? ps.sawmillPercent   ?? 10)) / 10
  const quarPct  = ((kingdom.quarryPercent     ?? ps.quarryPercent    ?? 10)) / 10
  const grainPct = ((kingdom.grainFarmPercent  ?? ps.grainFarmPercent ?? 10)) / 10
  const windPct  = ((kingdom.windmillPercent   ?? ps.windmillPercent  ?? 10)) / 10
  const catPct   = ((kingdom.cathedralPercent  ?? ps.cathedralPercent ?? 10)) / 10

  const energyProd = (windmillEnergy(kingdom.windmill  ?? 0) * windPct
                   + cathedralEnergy(kingdom.cathedral ?? 0, alchLv) * catPct) * energyClassBonus
  const energyCons = sawmillEnergy(kingdom.sawmill    ?? 0) * sawPct
                   + quarryEnergy(kingdom.quarry      ?? 0) * quarPct
                   + grainFarmEnergy(kingdom.grainFarm ?? 0) * grainPct
  const energyFactor = energyCons > 0 ? Math.min(1, energyProd / energyCons) : 1.0

  const woodRate  = basicWood  + (kingdom.woodProduction  ?? 0) * sawPct   * energyFactor * (1 + dl * 0.0100) * speed * classBonus
  const stoneRate = basicStone + (kingdom.stoneProduction ?? 0) * quarPct  * energyFactor * (1 + dl * 0.0066) * speed * classBonus
  const grainRate =              (kingdom.grainProduction ?? 0) * grainPct * energyFactor * (1 + dl * 0.0033) * speed * classBonus

  return {
    wood:  Math.min(kingdom.wood  + woodRate  * elapsed, kingdom.woodCapacity),
    stone: Math.min(kingdom.stone + stoneRate * elapsed, kingdom.stoneCapacity),
    grain: Math.min(kingdom.grain + grainRate * elapsed, kingdom.grainCapacity),
    now,
  }
}
