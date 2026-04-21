// ── Unit base stats ────────────────────────────────────────────────────────────
// hull = structuralIntegrity / 10 (OGame convention)
export const UNIT_STATS = {
  squire:       { hull: 400,    shield: 10,    attack: 50,     type: 'unit' },
  knight:       { hull: 1000,   shield: 25,    attack: 150,    type: 'unit' },
  paladin:      { hull: 2700,   shield: 50,    attack: 400,    type: 'unit' },
  warlord:      { hull: 6000,   shield: 200,   attack: 1000,   type: 'unit' },
  grandKnight:  { hull: 7000,   shield: 400,   attack: 700,    type: 'unit' },
  siegeMaster:  { hull: 7500,   shield: 500,   attack: 1000,   type: 'unit' },
  warMachine:   { hull: 11000,  shield: 500,   attack: 2000,   type: 'unit' },
  dragonKnight: { hull: 900000, shield: 50000, attack: 200000, type: 'unit' },
  merchant:     { hull: 400,    shield: 10,    attack: 5,      type: 'unit' },
  caravan:      { hull: 1200,   shield: 25,    attack: 5,      type: 'unit' },
  colonist:     { hull: 3000,   shield: 100,   attack: 50,     type: 'unit' },
  scavenger:    { hull: 1600,   shield: 10,    attack: 1,      type: 'unit' },
  scout:        { hull: 100,    shield: 0,     attack: 0,      type: 'unit' },
  archer:       { hull: 200,    shield: 20,    attack: 80,     type: 'defense' },
  crossbowman:  { hull: 200,    shield: 25,    attack: 100,    type: 'defense' },
  ballista:     { hull: 800,    shield: 100,   attack: 250,    type: 'defense' },
  trebuchet:    { hull: 3500,   shield: 200,   attack: 1100,   type: 'defense' },
  mageTower:    { hull: 800,    shield: 500,   attack: 150,    type: 'defense' },
  dragonCannon: { hull: 10000,  shield: 300,   attack: 3000,   type: 'defense' },
  palisade:     { hull: 2000,   shield: 2000,  attack: 1,      type: 'defense' },
  castleWall:   { hull: 5500,   shield: 10000, attack: 1,      type: 'defense' },
  moat:         { hull: 1500,   shield: 500,   attack: 50,     type: 'defense' },
  catapult:     { hull: 5000,   shield: 500,   attack: 750,    type: 'defense' },
  beacon:       { hull: 50,     shield: 1,     attack: 10,     type: 'defense' },
}

// rapid fire[attacker][defender] = guaranteed extra shots (OGame mapping)
// chance of another shot = 1 - 1/value  (value=5 → 80% chance of extra shot)
const RAPID_FIRE = {
  squire:       { scout: 5 },
  knight:       { merchant: 3, scout: 5 },
  paladin:      { squire: 6, knight: 3, merchant: 3, caravan: 3, scout: 5 },
  warlord:      { scout: 5 },
  // grandKnight = battlecruiser: heavy_fighter(4), cruiser(4), battle_ship(7), small/large_cargo(3)
  grandKnight:  { knight: 4, paladin: 4, warlord: 7, merchant: 3, caravan: 3 },
  // siegeMaster = bomber: all light defenses
  siegeMaster:  { archer: 20, crossbowman: 20, ballista: 10, trebuchet: 5, mageTower: 10 },
  // warMachine = destroyer: light_laser(10), battlecruiser(2)
  warMachine:   { crossbowman: 10, grandKnight: 2 },
  // dragonKnight = deathstar: corrected from OGame reference
  dragonKnight: {
    squire: 200, knight: 100, paladin: 33, warlord: 30, grandKnight: 15,
    siegeMaster: 25, warMachine: 5, merchant: 250, caravan: 250, colonist: 250,
    scavenger: 250, scout: 250, archer: 200, crossbowman: 200, ballista: 100,
    trebuchet: 50, mageTower: 100,
  },
}

// Unit costs for debris calculation (wood + stone only, matching OGame's metal+crystal basis)
// Values taken directly from units.js woodBase/stoneBase
const UNIT_COST = {
  squire:       { wood: 3000,    stone: 1000    },
  knight:       { wood: 6000,    stone: 4000    },
  paladin:      { wood: 20000,   stone: 7000    },
  warlord:      { wood: 45000,   stone: 15000   },
  grandKnight:  { wood: 30000,   stone: 40000   },
  siegeMaster:  { wood: 50000,   stone: 25000   },
  warMachine:   { wood: 60000,   stone: 50000   },
  dragonKnight: { wood: 5000000, stone: 4000000 },
  merchant:     { wood: 2000,    stone: 2000    },
  caravan:      { wood: 6000,    stone: 6000    },
  colonist:     { wood: 10000,   stone: 20000   },
  scavenger:    { wood: 10000,   stone: 6000    },
  scout:        { wood: 0,       stone: 1000    },
}

function applyBonus(base, level) {
  return Math.floor(base * (1 + level * 0.1))
}

// ── Build battle unit array from counts + research ─────────────────────────────
export function buildBattleUnits(unitCounts, res = {}) {
  const sword = res.swordsmanship ?? 0
  const arm   = res.armoury       ?? 0
  const fort  = res.fortification ?? 0

  const units = []
  for (const [id, count] of Object.entries(unitCounts)) {
    const n = count ?? 0
    if (n <= 0) continue
    const s = UNIT_STATS[id]
    if (!s) continue
    const hull   = applyBonus(s.hull,   fort)
    const shield = applyBonus(s.shield, arm)
    const attack = applyBonus(s.attack, sword)
    for (let i = 0; i < n; i++) {
      units.push({ id, type: s.type, hull, maxHull: hull, shield, maxShield: shield, attack })
    }
  }
  return units
}

// ── Single attack ─────────────────────────────────────────────────────────────
function attackUnit(attacker, defender) {
  const dmg = attacker.attack

  // Bounce if damage < 1% of defender's original shield
  if (defender.maxShield > 0 && dmg < defender.maxShield * 0.01) return false

  if (defender.shield > 0) {
    if (dmg <= defender.shield) {
      defender.shield -= dmg
    } else {
      defender.hull  -= dmg - defender.shield
      defender.shield = 0
    }
  } else {
    defender.hull -= dmg
  }

  // Random hull explosion below 70% integrity
  if (defender.hull > 0 && defender.hull < defender.maxHull * 0.7) {
    const chance = (1 - defender.hull / defender.maxHull) * 100
    if (Math.random() * 100 < chance) {
      defender.hull   = 0
      defender.shield = 0
    }
  }

  // Rapid fire
  const rf = RAPID_FIRE[attacker.id]?.[defender.id]
  if (rf) {
    const chance = 100 - 100 / rf
    return Math.random() * 100 < chance
  }
  return false
}

// ── One round (both sides attack simultaneously) ────────────────────────────────
function runRound(atk, def) {
  const fire = (shooters, targets) => {
    for (const shooter of shooters) {
      if (!targets.length) break
      let rf = false
      do {
        const t = targets[Math.floor(Math.random() * targets.length)]
        rf = attackUnit(shooter, t)
      } while (rf && targets.length)
    }
  }

  fire(atk, def)
  fire(def, atk)

  const survive = units => units.filter(u => {
    if (u.hull <= 0) return false
    u.shield = u.maxShield
    return true
  })

  return { atk: survive(atk), def: survive(def) }
}

// ── Full battle (max 6 rounds) ────────────────────────────────────────────────
export function runBattle(attackerUnits, defenderUnits) {
  // Count units per id before battle for loss tracking
  const countById = units => {
    const m = {}
    for (const u of units) m[u.id] = (m[u.id] ?? 0) + 1
    return m
  }

  let atk = attackerUnits.map(u => ({ ...u }))
  let def = defenderUnits.map(u => ({ ...u }))

  const initialAtk = countById(atk)
  const initialDef = countById(def)

  let rounds = 0
  while (rounds < 6 && atk.length > 0 && def.length > 0) {
    rounds++;
    ({ atk, def } = runRound(atk, def))
  }

  const survivingAtk = countById(atk)
  const survivingDef = countById(def)

  const lostAtk = {}, lostDef = {}
  for (const id in initialAtk) lostAtk[id] = initialAtk[id] - (survivingAtk[id] ?? 0)
  for (const id in initialDef) lostDef[id] = initialDef[id] - (survivingDef[id] ?? 0)

  let outcome
  if (atk.length === 0 && def.length === 0) outcome = 'draw'
  else if (atk.length === 0) outcome = 'defeat'
  else outcome = 'victory'

  return { outcome, rounds, survivingAtk, survivingDef, lostAtk, lostDef }
}

// ── Loot (50% of defender resources, limited by cargo capacity) ───────────────
export function calculateLoot(defRes, cargoCapacity) {
  const max = {
    wood:  Math.floor((defRes.wood  ?? 0) * 0.5),
    stone: Math.floor((defRes.stone ?? 0) * 0.5),
    grain: Math.floor((defRes.grain ?? 0) * 0.5),
  }
  const total = max.wood + max.stone + max.grain
  if (!cargoCapacity || total === 0) return { wood: 0, stone: 0, grain: 0 }
  if (cargoCapacity >= total) return max

  const keys = ['wood', 'stone', 'grain']
  const result = { wood: 0, stone: 0, grain: 0 }
  const maxPer = Math.floor(cargoCapacity / 3)
  for (const k of keys) result[k] = Math.min(max[k], maxPer)

  let rem = cargoCapacity - result.wood - result.stone - result.grain
  while (rem > 1) {
    const unfilled = keys.filter(k => max[k] > result[k])
    if (!unfilled.length) break
    for (const k of unfilled) {
      result[k] = Math.min(max[k], result[k] + rem / unfilled.length)
    }
    const newRem = cargoCapacity - result.wood - result.stone - result.grain
    if (newRem >= rem) break
    rem = newRem
  }

  return { wood: Math.floor(result.wood), stone: Math.floor(result.stone), grain: Math.floor(result.grain) }
}

// ── Debris (default 30% of destroyed unit costs; expeditions use 10%) ────────
export function calculateDebris(lostAtk, lostDef, rate = 0.3) {
  let wood = 0, stone = 0
  const all = [lostAtk, lostDef]
  for (const losses of all) {
    for (const [id, count] of Object.entries(losses)) {
      if (!count) continue
      const cost = UNIT_COST[id]
      if (!cost) continue
      wood  += Math.floor(cost.wood  * count * rate)
      stone += Math.floor(cost.stone * count * rate)
    }
  }
  return { wood, stone }
}

// ── Defense repair (70% per unit after battle) ───────────────────────────────
export function repairDefenses(lostDef, repairRate = 70) {
  const repaired = {}
  for (const [id, count] of Object.entries(lostDef)) {
    if (!count) continue
    const s = UNIT_STATS[id]
    if (!s || s.type !== 'defense') continue
    let fixed = 0
    for (let i = 0; i < count; i++) {
      if (Math.random() * 100 < repairRate) fixed++
    }
    if (fixed > 0) repaired[id] = fixed
  }
  return repaired
}

// ── Cargo capacity ────────────────────────────────────────────────────────────
const CARGO_CAP = { merchant: 5000, caravan: 25000, colonist: 7500, scavenger: 20000 }
export function calcCargoCapacity(units) {
  return Object.entries(units).reduce((s, [id, n]) => s + (CARGO_CAP[id] ?? 0) * (n ?? 0), 0)
}
