import {
  windmillEnergy, cathedralEnergy,
  sawmillEnergy, quarryEnergy, grainFarmEnergy,
} from './buildings.js'

/**
 * Compute ticked resources without writing to DB.
 * Applies energy balance and mine throttle — same formula as kingdoms/me.js.
 * @param {string|null} characterClass — collector gets +25% production
 * @param {Object|null} res — research row (for alchemy level)
 */
export function applyResourceTick(kingdom, cfg, characterClass = null, res = null) {
  const now     = Math.floor(Date.now() / 1000)
  const elapsed = Math.max(0, now - kingdom.lastResourceUpdate) / 3600
  const speed   = cfg.economy_speed ?? 1

  if (elapsed <= 0) {
    return { wood: kingdom.wood, stone: kingdom.stone, grain: kingdom.grain, now }
  }

  const alchLv     = res?.alchemy ?? 0
  const classBonus = characterClass === 'collector' ? 1.25 : 1.0

  const sawPct   = (kingdom.sawmillPercent    ?? 10) / 10
  const quarPct  = (kingdom.quarryPercent     ?? 10) / 10
  const grainPct = (kingdom.grainFarmPercent  ?? 10) / 10
  const windPct  = (kingdom.windmillPercent   ?? 10) / 10
  const catPct   = (kingdom.cathedralPercent  ?? 10) / 10

  const energyProd = windmillEnergy(kingdom.windmill  ?? 0) * windPct
                   + cathedralEnergy(kingdom.cathedral ?? 0, alchLv) * catPct
  const energyCons = sawmillEnergy(kingdom.sawmill    ?? 0) * sawPct
                   + quarryEnergy(kingdom.quarry      ?? 0) * quarPct
                   + grainFarmEnergy(kingdom.grainFarm ?? 0) * grainPct
  const energyFactor = energyCons > 0 ? Math.min(1, energyProd / energyCons) : 1.0

  return {
    wood:  Math.min(kingdom.wood  + kingdom.woodProduction  * sawPct   * energyFactor * speed * classBonus * elapsed, kingdom.woodCapacity),
    stone: Math.min(kingdom.stone + kingdom.stoneProduction * quarPct  * energyFactor * speed * classBonus * elapsed, kingdom.stoneCapacity),
    grain: Math.min(kingdom.grain + kingdom.grainProduction * grainPct * energyFactor * speed * classBonus * elapsed, kingdom.grainCapacity),
    now,
  }
}
