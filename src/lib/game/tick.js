import {
  windmillEnergy, cathedralEnergy,
  sawmillEnergy, quarryEnergy, grainFarmEnergy,
} from './buildings.js'

// Mirrors production.js _lfProdMults — both must stay in sync.
function _lfProdMults(lfResearch) {
  if (!lfResearch || Object.keys(lfResearch).length === 0) return { wood: 1, stone: 1, grain: 1 }
  const EFFECTS = {
    extractoresHP:       [{ t: 'all',   b: 0.06 }],
    tecProduccionMejorada:[{ t: 'all',  b: 0.06 }],
    escaneAcustico:      [{ t: 'stone', b: 0.08 }],
    sistemaBombeoHP:     [{ t: 'grain', b: 0.08 }],
    produccionMagma:     [{ t: 'all',   b: 0.08 }],
    sondeoProf:          [{ t: 'wood',  b: 0.08 }],
    perforadoresDiamante:[{ t: 'wood',  b: 0.08 }],
    mineriaSismica:      [{ t: 'stone', b: 0.08 }],
    sistemaBombeoMagma:  [{ t: 'grain', b: 0.08 }],
    tecnologiaCatalizador:[{ t: 'grain',b: 0.08 }],
    lineasTransporte:    [{ t: 'all',   b: 0.06 }],
    inteligenciaEnjambre:[{ t: 'all',   b: 0.06 }],
    procesoSulfuro:      [{ t: 'grain', b: 0.08 }],
    psicoharmonizador:   [{ t: 'all',   b: 0.06 }],
  }
  let all = 0, wood = 0, stone = 0, grain = 0
  for (const [id, effs] of Object.entries(EFFECTS)) {
    const lv = lfResearch[id] ?? 0
    if (lv === 0) continue
    for (const e of effs) {
      const v = e.b * lv
      if (e.t === 'all')   all   += v
      if (e.t === 'wood')  wood  += v
      if (e.t === 'stone') stone += v
      if (e.t === 'grain') grain += v
    }
  }
  return { wood: 1 + all + wood, stone: 1 + all + stone, grain: 1 + all + grain }
}

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

  const alchLv     = res?.alchemy    ?? 0
  const dl         = res?.dragonlore ?? 0
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

  const lfMults = _lfProdMults(kingdom.lfResearch ?? {})

  const woodRate  = (basicWood  + (kingdom.woodProduction  ?? 0) * sawPct   * energyFactor * (1 + dl * 0.0100) * speed * classBonus) * lfMults.wood
  const stoneRate = (basicStone + (kingdom.stoneProduction ?? 0) * quarPct  * energyFactor * (1 + dl * 0.0066) * speed * classBonus) * lfMults.stone
  const grainRate =               (kingdom.grainProduction ?? 0) * grainPct * energyFactor * (1 + dl * 0.0033) * speed * classBonus  * lfMults.grain

  return {
    wood:  Math.min(kingdom.wood  + woodRate  * elapsed, kingdom.woodCapacity),
    stone: Math.min(kingdom.stone + stoneRate * elapsed, kingdom.stoneCapacity),
    grain: Math.min(kingdom.grain + grainRate * elapsed, kingdom.grainCapacity),
    now,
  }
}
