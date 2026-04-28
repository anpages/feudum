/**
 * Pure helpers to compute effective hourly production and unit population usage
 * given a kingdom row + research row + server settings + character class.
 *
 * Mirrors the inline logic in api/kingdoms/me.js so the client can derive the same
 * values without round-tripping the API.
 */

import {
  windmillEnergy, cathedralEnergy,
  sawmillEnergy, quarryEnergy, grainFarmEnergy,
} from './buildings.js'
import { UNITS, SUPPORT_UNITS } from './units.js'

/**
 * @param {*} kingdom
 * @param {*} res
 * @param {*} cfg
 * @param {string|null} [characterClass]
 * @param {{ wood?: number, stone?: number, grain?: number, researchSpeed?: number, combatDef?: number } | null} [poiBonus]
 */
export function effectiveProduction(kingdom, res, cfg, characterClass = null, poiBonus = null) {
  const dl         = res?.dragonlore ?? 0
  const alchLv     = res?.alchemy    ?? 0
  const speed      = cfg?.economy_speed ?? 1
  const basicWood  = cfg?.basic_wood  ?? 0
  const basicStone = cfg?.basic_stone ?? 0
  const classBonus      = characterClass === 'collector' ? 1.25 : 1.0
  const energyClassBonus = characterClass === 'collector' ? 1.10 : 1.0
  // POI bonus permanente: yacimientos suman a producción de su recurso (+15% típico)
  const poiWood  = 1 + (poiBonus?.wood  ?? 0)
  const poiStone = 1 + (poiBonus?.stone ?? 0)
  const poiGrain = 1 + (poiBonus?.grain ?? 0)

  const sawPct   = (kingdom.sawmillPercent    ?? 10) / 10
  const quarPct  = (kingdom.quarryPercent     ?? 10) / 10
  const grainPct = (kingdom.grainFarmPercent  ?? 10) / 10
  const windPct  = (kingdom.windmillPercent   ?? 10) / 10
  const catPct   = (kingdom.cathedralPercent  ?? 10) / 10

  const energyProd = (windmillEnergy(kingdom.windmill ?? 0) * windPct
                   + cathedralEnergy(kingdom.cathedral ?? 0, alchLv) * catPct) * energyClassBonus

  const energyCons = sawmillEnergy(kingdom.sawmill    ?? 0) * sawPct
                   + quarryEnergy(kingdom.quarry      ?? 0) * quarPct
                   + grainFarmEnergy(kingdom.grainFarm ?? 0) * grainPct

  const energyFactor = energyCons > 0
    ? Math.min(1, energyProd / energyCons)
    : 1.0

  const wood  = basicWood  + (kingdom.woodProduction  ?? 0) * sawPct   * energyFactor * (1 + dl * 0.010)  * speed * classBonus * poiWood
  const stone = basicStone + (kingdom.stoneProduction ?? 0) * quarPct  * energyFactor * (1 + dl * 0.0066) * speed * classBonus * poiStone
  const grain =              (kingdom.grainProduction ?? 0) * grainPct * energyFactor * (1 + dl * 0.0033) * speed * classBonus * poiGrain

  return { wood, stone, grain, energyProd, energyCons }
}

/** Sum mobile units (UNITS + SUPPORT_UNITS) currently in the kingdom. */
export function mobileUnitsCount(kingdom) {
  let total = 0
  for (const def of UNITS)         total += kingdom[def.id] ?? 0
  for (const def of SUPPORT_UNITS) total += kingdom[def.id] ?? 0
  return total
}
