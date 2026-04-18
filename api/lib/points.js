// Cumulative resources spent → points (÷1000, OGame convention)

const BUILDING_DEFS = {
  sawmill:        { wood: 60,       stone: 15,      grain: 0,      factor: 1.5  },
  quarry:         { wood: 48,       stone: 24,      grain: 0,      factor: 1.6  },
  grainFarm:      { wood: 225,      stone: 75,      grain: 0,      factor: 1.5  },
  windmill:       { wood: 75,       stone: 30,      grain: 0,      factor: 1.5  },
  cathedral:      { wood: 900,      stone: 360,     grain: 180,    factor: 1.8  },
  granary:        { wood: 1000,     stone: 0,       grain: 0,      factor: 2.0  },
  stonehouse:     { wood: 1000,     stone: 500,     grain: 0,      factor: 2.0  },
  silo:           { wood: 1000,     stone: 1000,    grain: 0,      factor: 2.0  },
  workshop:       { wood: 400,      stone: 120,     grain: 0,      factor: 2.0  },
  engineersGuild: { wood: 1000000,  stone: 500000,  grain: 0,      factor: 2.0  },
  barracks:       { wood: 400,      stone: 200,     grain: 0,      factor: 2.0  },
  academy:        { wood: 200,      stone: 400,     grain: 0,      factor: 2.0  },
  alchemistTower: { wood: 500,      stone: 1000,    grain: 200,    factor: 1.75 },
  ambassadorHall: { wood: 200,      stone: 600,     grain: 200,    factor: 2.0  },
  armoury:        { wood: 200,      stone: 400,     grain: 0,      factor: 2.0  },
}

const RESEARCH_DEFS = {
  alchemy:           { wood: 0,      stone: 800,    grain: 400,    factor: 2    },
  pyromancy:         { wood: 200,    stone: 100,    grain: 0,      factor: 2    },
  runemastery:       { wood: 1000,   stone: 300,    grain: 100,    factor: 2    },
  mysticism:         { wood: 0,      stone: 4000,   grain: 2000,   factor: 2    },
  dragonlore:        { wood: 2000,   stone: 4000,   grain: 1000,   factor: 2    },
  swordsmanship:     { wood: 800,    stone: 200,    grain: 0,      factor: 2    },
  armoury:           { wood: 200,    stone: 600,    grain: 0,      factor: 2    },
  fortification:     { wood: 1000,   stone: 0,      grain: 0,      factor: 2    },
  horsemanship:      { wood: 400,    stone: 0,      grain: 600,    factor: 2    },
  cartography:       { wood: 2000,   stone: 4000,   grain: 600,    factor: 2    },
  tradeRoutes:       { wood: 10000,  stone: 20000,  grain: 6000,   factor: 2    },
  spycraft:          { wood: 200,    stone: 1000,   grain: 200,    factor: 2    },
  logistics:         { wood: 0,      stone: 400,    grain: 600,    factor: 2    },
  exploration:       { wood: 4000,   stone: 8000,   grain: 4000,   factor: 1.75 },
  diplomaticNetwork: { wood: 240000, stone: 400000, grain: 160000, factor: 2    },
  divineBlessing:    { wood: 0,      stone: 0,      grain: 0,      factor: 2    },
}

const UNIT_COSTS = {
  squire:       { wood: 3000,    stone: 1000,    grain: 0       },
  knight:       { wood: 6000,    stone: 4000,    grain: 0       },
  paladin:      { wood: 20000,   stone: 7000,    grain: 2000    },
  warlord:      { wood: 45000,   stone: 15000,   grain: 0       },
  grandKnight:  { wood: 30000,   stone: 40000,   grain: 15000   },
  siegeMaster:  { wood: 50000,   stone: 25000,   grain: 15000   },
  warMachine:   { wood: 60000,   stone: 50000,   grain: 15000   },
  dragonKnight: { wood: 5000000, stone: 4000000, grain: 1000000 },
  merchant:     { wood: 2000,    stone: 2000,    grain: 0       },
  caravan:      { wood: 6000,    stone: 6000,    grain: 0       },
  colonist:     { wood: 10000,   stone: 20000,   grain: 10000   },
  scavenger:    { wood: 10000,   stone: 6000,    grain: 2000    },
  scout:        { wood: 0,       stone: 1000,    grain: 0       },
  archer:       { wood: 2000,    stone: 0,       grain: 0       },
  crossbowman:  { wood: 1500,    stone: 500,     grain: 0       },
  ballista:     { wood: 6000,    stone: 2000,    grain: 0       },
  trebuchet:    { wood: 20000,   stone: 15000,   grain: 2000    },
  mageTower:    { wood: 2000,    stone: 6000,    grain: 0       },
  dragonCannon: { wood: 50000,   stone: 50000,   grain: 30000   },
  palisade:     { wood: 10000,   stone: 10000,   grain: 0       },
  castleWall:   { wood: 50000,   stone: 50000,   grain: 0       },
}

function buildingPoints(def, level) {
  let total = 0
  for (let i = 0; i < level; i++) {
    const f = Math.pow(def.factor, i)
    total += Math.floor(def.wood  * f)
           + Math.floor(def.stone * f)
           + Math.floor((def.grain ?? 0) * f)
  }
  return total
}

function researchPoints(def, level) {
  let total = 0
  for (let i = 0; i < level; i++) {
    const f = Math.pow(def.factor, i)
    total += Math.floor(def.wood  * f)
           + Math.floor(def.stone * f)
           + Math.floor(def.grain * f)
  }
  return total
}

export function calcPoints(kingdom, res = {}) {
  let raw = 0

  for (const [id, def] of Object.entries(BUILDING_DEFS)) {
    const lv = kingdom[id] ?? 0
    if (lv > 0) raw += buildingPoints(def, lv)
  }

  for (const [id, def] of Object.entries(RESEARCH_DEFS)) {
    const lv = res[id] ?? 0
    if (lv > 0) raw += researchPoints(def, lv)
  }

  for (const [id, cost] of Object.entries(UNIT_COSTS)) {
    const n = kingdom[id] ?? 0
    if (n > 0) raw += (cost.wood + cost.stone + cost.grain) * n
  }

  return Math.floor(raw / 1000)
}
