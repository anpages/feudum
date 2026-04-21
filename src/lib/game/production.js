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

// LF production bonus — must mirror api/lib/lifeforms.js calcLFProductionBonus
// Kept inline to avoid cross-boundary imports (this file runs on both client and server).
// Effect types 'production_all/wood/stone/grain': base * level = additive % bonus.
// The LF research data is loaded lazily to avoid bundling the full lifeforms data.
function _lfProdMults(lfResearch) {
  if (!lfResearch || Object.keys(lfResearch).length === 0) {
    return { wood: 1, stone: 1, grain: 1 }
  }
  // Inline effect table — only production effects needed here
  const EFFECTS = {
    // Romanos
    extractoresHP:       [{ t: 'all',   b: 0.06 }],
    tecProduccionMejorada: [{ t: 'all', b: 0.06 }],
    // Vikingos
    escaneAcustico:      [{ t: 'stone', b: 0.08 }],
    sistemaBombeoHP:     [{ t: 'grain', b: 0.08 }],
    produccionMagma:     [{ t: 'all',   b: 0.08 }],
    sondeoProf:          [{ t: 'wood',  b: 0.08 }],
    perforadoresDiamante:[{ t: 'wood',  b: 0.08 }],
    mineriaSismica:      [{ t: 'stone', b: 0.08 }],
    sistemaBombeoMagma:  [{ t: 'grain', b: 0.08 }],
    // Bizantinos
    tecnologiaCatalizador:[{ t: 'grain', b: 0.08 }],
    lineasTransporte:    [{ t: 'all',   b: 0.06 }],
    inteligenciaEnjambre:[{ t: 'all',   b: 0.06 }],
    // Sarracenos
    procesoSulfuro:      [{ t: 'grain', b: 0.08 }],
    psicoharmonizador:   [{ t: 'all',   b: 0.06 }],
  }
  let all = 0, wood = 0, stone = 0, grain = 0
  for (const [id, effs] of Object.entries(EFFECTS)) {
    const lv = lfResearch[id] ?? 0
    if (lv === 0) continue
    for (const e of effs) {
      const v = e.b * lv
      if (e.t === 'all')   { all   += v }
      if (e.t === 'wood')  { wood  += v }
      if (e.t === 'stone') { stone += v }
      if (e.t === 'grain') { grain += v }
    }
  }
  return { wood: 1 + all + wood, stone: 1 + all + stone, grain: 1 + all + grain }
}

export function effectiveProduction(kingdom, res, cfg, characterClass = null) {
  const dl         = res?.dragonlore ?? 0
  const alchLv     = res?.alchemy    ?? 0
  const speed      = cfg?.economy_speed ?? 1
  const basicWood  = cfg?.basic_wood  ?? 0
  const basicStone = cfg?.basic_stone ?? 0
  const classBonus = characterClass === 'collector' ? 1.25 : 1.0

  const sawPct   = (kingdom.sawmillPercent    ?? 10) / 10
  const quarPct  = (kingdom.quarryPercent     ?? 10) / 10
  const grainPct = (kingdom.grainFarmPercent  ?? 10) / 10
  const windPct  = (kingdom.windmillPercent   ?? 10) / 10
  const catPct   = (kingdom.cathedralPercent  ?? 10) / 10

  const energyProd = windmillEnergy(kingdom.windmill ?? 0) * windPct
                   + cathedralEnergy(kingdom.cathedral ?? 0, alchLv) * catPct

  const energyCons = sawmillEnergy(kingdom.sawmill    ?? 0) * sawPct
                   + quarryEnergy(kingdom.quarry      ?? 0) * quarPct
                   + grainFarmEnergy(kingdom.grainFarm ?? 0) * grainPct

  const energyFactor = energyCons > 0
    ? Math.min(1, energyProd / energyCons)
    : 1.0

  const lfRes   = kingdom.lfResearch ?? {}
  const lfMults = _lfProdMults(lfRes)

  const wood  = (basicWood  + (kingdom.woodProduction  ?? 0) * sawPct   * energyFactor * (1 + dl * 0.010)  * speed * classBonus) * lfMults.wood
  const stone = (basicStone + (kingdom.stoneProduction ?? 0) * quarPct  * energyFactor * (1 + dl * 0.0066) * speed * classBonus) * lfMults.stone
  const grain =               (kingdom.grainProduction ?? 0) * grainPct * energyFactor * (1 + dl * 0.0033) * speed * classBonus  * lfMults.grain

  return { wood, stone, grain, energyProd, energyCons }
}

/** Sum mobile units (UNITS + SUPPORT_UNITS) currently in the kingdom. */
export function mobileUnitsCount(kingdom) {
  let total = 0
  for (const def of UNITS)         total += kingdom[def.id] ?? 0
  for (const def of SUPPORT_UNITS) total += kingdom[def.id] ?? 0
  return total
}
