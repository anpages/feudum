/**
 * NPC hourly cron — resource tick + growth AI + attack AI + return processing.
 * Called by Vercel Cron: schedule "0 * * * *"
 * Secured with CRON_SECRET header.
 */
import { eq, and, lte, gte, or, lt } from 'drizzle-orm'
import { db, users, kingdoms, armyMissions, messages, debrisFields } from '../_db.js'
import { applyResourceTick } from '../lib/tick.js'
import { BUILDINGS, buildCost, buildTime, applyBuildingEffect } from '../lib/buildings.js'
import { ALL_UNITS } from '../lib/units.js'
import { ECONOMY_SPEED, NPC_AGGRESSION, NPC_ATTACK_INTERVAL_HOURS, NPC_BASH_LIMIT } from '../lib/config.js'
import { calcDistance, calcDuration } from '../lib/speed.js'
import {
  buildBattleUnits, runBattle, calculateLoot,
  calculateDebris, repairDefenses, calcCargoCapacity,
} from '../lib/battle.js'
import { insertBattleLog, sumLosses } from '../lib/battle_log.js'
import { processScavenge } from '../lib/missions/scavenge.js'
import { resolveExpedition } from '../lib/expedition.js'
import { calcPoints } from '../lib/points.js'
import { sendPush } from '../lib/push.js'
import { getSettings, setSetting } from '../lib/settings.js'
import { startNewSeason, repairSeasonNpcsIfMissing } from '../lib/season.js'

// ── Identity system ───────────────────────────────────────────────────────────
// Both personality and class are deterministic from position — never change.
// Personality: build order + attack behavior
// Class: numerical stat bonuses (mirrors player character class system)

function npcPersonality(kingdom) {
  const h = ((kingdom.realm * 374761 + kingdom.region * 6271 + kingdom.slot * 1013) >>> 0) % 3
  return ['economy', 'military', 'balanced'][h]
}

function npcClass(kingdom) {
  // Different hash seed so class is independent from personality (9 combinations)
  const h = ((kingdom.realm * 571349 + kingdom.region * 31337 + kingdom.slot * 9901) >>> 0) % 3
  return ['collector', 'general', 'discoverer'][h]
}

// Class stat modifiers applied in growth + combat:
// collector:  +25% resource production (accumulates faster, harder to loot dry)
// general:    −10% unit cost, +1 extra unit type trained per tick, attacks more aggressively
// discoverer: +1 extra building per tick (researches / builds faster), wider attack search radius

// ── Virtual research derived from NPC building levels ────────────────────────
// NPCs don't have research rows. This function maps building levels to equivalent
// research levels so unit unlock requirements and travel drive bonuses are
// consistent with the player progression (no schema changes needed).
function npcResearch(kingdom) {
  const b = kingdom.barracks ?? 0
  const a = kingdom.academy  ?? 0
  const r = kingdom.armoury  ?? 0
  return {
    horsemanship:      b,
    swordsmanship:     b,
    fortification:     r,
    armoury:           r,
    cartography:       a,
    tradeRoutes:       Math.max(0, a - 2),
    alchemy:           a,
    pyromancy:         Math.max(0, a - 1),
    runemastery:       Math.max(0, a - 3),
    mysticism:         Math.max(0, a - 4),
    dragonlore:        Math.max(0, a - 7),
    spycraft:          a,
    logistics:         a,
    exploration:       a,
    diplomaticNetwork: a,
    divineBlessing:    Math.max(0, a - 9),
  }
}

// ── Build priorities per personality ─────────────────────────────────────────
// economy:  focus production first, barracks last
// military: barracks early, then enough production to sustain army
// balanced: steady mix

// ── Building weights per personality ─────────────────────────────────────────
// Higher weight = higher priority. NPCs always upgrade the building most
// "behind" relative to its weight (score = currentLevel / weight → lowest wins).
// No ceiling — growth is infinite and exponential.
const BUILD_WEIGHTS = {
  economy: {
    sawmill: 1.0, windmill: 1.5, quarry: 0.85, grainFarm: 0.70,
    cathedral: 0.50, granary: 0.55, stonehouse: 0.50, silo: 0.45,
    workshop: 0.65, barracks: 0.60, academy: 0.25,
    alchemistTower: 0.40, ambassadorHall: 0.20, armoury: 0.35, engineersGuild: 0.35,
  },
  military: {
    barracks: 1.0, sawmill: 0.75, windmill: 1.5, quarry: 0.65, workshop: 0.60,
    grainFarm: 0.55, armoury: 0.50, granary: 0.35,
    stonehouse: 0.35, silo: 0.30, academy: 0.25,
    alchemistTower: 0.25, ambassadorHall: 0.30, cathedral: 0.20, engineersGuild: 0.25,
  },
  balanced: {
    sawmill: 0.90, windmill: 1.5, barracks: 0.80, quarry: 0.75, grainFarm: 0.65,
    workshop: 0.60, granary: 0.45, stonehouse: 0.40,
    silo: 0.35, academy: 0.30, alchemistTower: 0.35,
    armoury: 0.35, ambassadorHall: 0.25, cathedral: 0.30, engineersGuild: 0.30,
  },
}

// ── Unit training priority per personality (no cap, ordered by preference) ───
// Mobile units (squire, knight, …) come first so totalArmy() reaches attack
// threshold. Defenses (archer, crossbowman, …) are still trained but secondary.
// Support units (merchant, caravan, scavenger) included per personality:
//   economy  — prioritizes them early (expedition loot + scavenging are core strategy)
//   balanced — merchant early, scavenger mid, caravan late
//   military — combat focus; merchant/scavenger only as fallback after all combat units
const UNIT_PRIORITY = {
  economy:  ['squire', 'merchant', 'archer', 'caravan', 'crossbowman', 'knight', 'scavenger', 'mageTower', 'ballista', 'paladin', 'warlord', 'grandKnight', 'siegeMaster', 'warMachine', 'dragonKnight'],
  military: ['squire', 'knight', 'archer', 'crossbowman', 'paladin', 'warlord', 'ballista', 'mageTower', 'grandKnight', 'siegeMaster', 'warMachine', 'dragonKnight', 'merchant', 'scavenger'],
  balanced: ['squire', 'merchant', 'archer', 'knight', 'crossbowman', 'scavenger', 'paladin', 'mageTower', 'ballista', 'caravan', 'warlord', 'grandKnight', 'siegeMaster', 'warMachine', 'dragonKnight'],
}

// ── Attack threshold per personality (min MOBILE army units before attacking) ─
const ATTACK_THRESHOLD = {
  economy:  8,
  military: 5,
  balanced: 6,
}

// ── Unit costs (wood/stone/grain to train one unit) ───────────────────────────
const UNIT_COSTS = {
  squire:      { wood: 3000,    stone: 1000,   grain: 0    },
  archer:      { wood: 2000,    stone: 0,      grain: 0    },
  crossbowman: { wood: 1500,    stone: 500,    grain: 0    },
  knight:      { wood: 6000,    stone: 4000,   grain: 0    },
  ballista:    { wood: 6000,    stone: 2000,   grain: 0    },
  mageTower:   { wood: 2000,    stone: 6000,   grain: 0    },
  paladin:     { wood: 20000,   stone: 7000,   grain: 0    },
  warlord:     { wood: 45000,   stone: 15000,  grain: 0    },
  grandKnight: { wood: 30000,   stone: 40000,  grain: 0    },
  siegeMaster: { wood: 50000,   stone: 25000,  grain: 0    },
  warMachine:  { wood: 60000,   stone: 50000,  grain: 0    },
  dragonKnight:{ wood: 5000000, stone: 4000000,grain: 0    },
  merchant:    { wood: 2000,    stone: 2000,   grain: 0    },
  caravan:     { wood: 6000,    stone: 6000,   grain: 0    },
  scavenger:   { wood: 10000,   stone: 6000,   grain: 2000 },
}

const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

const UNIT_COMBAT_SET  = new Set(['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight'])
const UNIT_SUPPORT_SET = new Set(['merchant','caravan','scavenger'])
const UNIT_DEFENSE_SET = new Set(['archer','crossbowman','ballista','mageTower','trebuchet','dragonCannon','castleWall','moat','catapult'])

function totalArmy(k) {
  return UNIT_KEYS.reduce((s, u) => s + (k[u] ?? 0), 0)
}

// ── Growth AI — infinite, exponential, no ceiling ────────────────────────────
// Buildings: always upgrade the building most "behind" its priority weight.
// Units: always train more of the highest-priority unit the barracks supports.
// Growth is naturally exponential: more production → more resources → faster builds.
// Boss kingdoms use military personality + no batch limit + 2× build speed.

async function growNpc(kingdom, cfg, now) {
  const isBoss      = kingdom.isBoss ?? false
  const personality = isBoss ? 'military' : npcPersonality(kingdom)
  const cls         = isBoss ? 'general'  : npcClass(kingdom)
  const weights     = BUILD_WEIGHTS[personality]
  const speed       = parseFloat(cfg.economy_speed ?? ECONOMY_SPEED)
  const npcLv       = Math.max(1, kingdom.npcLevel ?? 1)

  const buildAvailable = kingdom.npcBuildAvailableAt ?? 0
  const canBuild = now >= buildAvailable

  let { wood, stone, grain } = kingdom
  let patch = {}

  let trainedCombat  = false
  let trainedDefense = false
  let trainedSupport = false
  let builtBuilding  = false

  const combatTotal    = [...UNIT_COMBAT_SET].reduce((s, u) => s + (kingdom[u] ?? 0), 0)
  const needMoreCombat = combatTotal < ATTACK_THRESHOLD[personality]

  // ── Unit training (combat first, then support+defense only after threshold) ─
  // Support (merchant/caravan) and defense are blocked until the NPC has real
  // combat units — otherwise cheap support units count towards armySize and
  // NPCs "attack" with merchants, or crossbowmen drain wood before squire.
  const maxUnitTypes = isBoss ? 3 : (cls === 'general' ? 2 : 1)
  const batchCap     = isBoss ? 200 : 50
  const costMult     = (isBoss || cls === 'general') ? 0.9 : 1.0
  let unitTypesTrained = 0

  const researchLevels = npcResearch({ ...kingdom })

  for (const unitId of UNIT_PRIORITY[personality]) {
    if (unitTypesTrained >= maxUnitTypes) break

    const unitDef = ALL_UNITS.find(u => u.id === unitId)
    if (!unitDef) continue

    if (unitDef.requires?.length) {
      const blocked = unitDef.requires.some(req => {
        if (req.type === 'building') return (kingdom[req.id] ?? 0) < req.level
        if (req.type === 'research') return (researchLevels[req.id] ?? 0) < req.level
        return false
      })
      if (blocked) continue
    }

    if ((UNIT_DEFENSE_SET.has(unitId) || UNIT_SUPPORT_SET.has(unitId)) && needMoreCombat) continue

    const cost = UNIT_COSTS[unitId]
    if (!cost) continue

    const effWood  = Math.ceil(cost.wood  * costMult)
    const effStone = Math.ceil(cost.stone * costMult)
    const effGrain = Math.ceil((cost.grain ?? 0) * costMult)
    if (effWood > wood || effStone > stone || effGrain > grain) continue

    const canAfford = Math.min(
      effWood  > 0 ? Math.floor(wood  / effWood)  : Infinity,
      effStone > 0 ? Math.floor(stone / effStone) : Infinity,
      effGrain > 0 ? Math.floor(grain / effGrain) : Infinity,
    )
    if (canAfford <= 0) continue

    const batch = Math.min(canAfford, batchCap)
    wood  -= effWood  * batch
    stone -= effStone * batch
    grain -= effGrain * batch
    patch[unitId] = (kingdom[unitId] ?? 0) + batch
    unitTypesTrained++

    if      (UNIT_COMBAT_SET.has(unitId))  trainedCombat  = true
    else if (UNIT_SUPPORT_SET.has(unitId)) trainedSupport = true
    else if (UNIT_DEFENSE_SET.has(unitId)) trainedDefense = true
  }

  // ── Building upgrade (after units, reserving squire cost while combat is low) ─
  // When the NPC still needs combat units, buildings only get wood that is
  // surplus above squireCost — so squire saving is never blocked by a build.
  if (canBuild) {
    const squireWoodReserve  = needMoreCombat ? Math.ceil((UNIT_COSTS.squire?.wood  ?? 3000) * costMult) : 0
    const squireStoneReserve = needMoreCombat ? Math.ceil((UNIT_COSTS.squire?.stone ?? 1000) * costMult) : 0
    const buildableWood  = wood  - squireWoodReserve
    const buildableStone = stone - squireStoneReserve

    const candidates = Object.entries(weights)
      .map(([id, weight]) => {
        const def = BUILDINGS.find(x => x.id === id)
        if (!def) return null
        const currentLv = kingdom[id] ?? 0
        return { id, def, currentLv, score: currentLv / weight }
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)

    for (const { id, def, currentLv } of candidates) {
      if (def.requires?.length) {
        const blocked = def.requires.some(req => {
          if (req.type !== 'building') return false
          return (kingdom[req.id] ?? 0) < req.level
        })
        if (blocked) continue
      }

      const nextLv = currentLv + 1
      const cost = buildCost(def.woodBase, def.stoneBase, def.factor, nextLv - 1, def.grainBase ?? 0)

      if (buildableWood >= cost.wood && buildableStone >= cost.stone && grain >= (cost.grain ?? 0)) {
        wood  -= cost.wood
        stone -= cost.stone
        grain -= (cost.grain ?? 0)

        const effect = applyBuildingEffect(id, nextLv, { ...kingdom, ...patch })
        Object.assign(patch, effect)

        const workshopLv       = (patch.workshop       ?? kingdom.workshop)       ?? 0
        const engineersGuildLv = (patch.engineersGuild ?? kingdom.engineersGuild) ?? 0
        const rawTime  = buildTime(cost.wood, cost.stone, nextLv, workshopLv, engineersGuildLv, speed)
        const timeBonus = isBoss ? 0.5 : (cls === 'discoverer' ? 0.75 : 1.0)
        patch.npcBuildAvailableAt = now + Math.max(30, Math.floor(rawTime * timeBonus))
        builtBuilding = true
        break
      }
    }
  }

  if (Object.keys(patch).length > 0) {
    await db.update(kingdoms).set({
      ...patch,
      wood, stone, grain,
      lastResourceUpdate: now,
      updatedAt: new Date(),
    }).where(eq(kingdoms.id, kingdom.id))
  }

  return { builtBuilding, trainedCombat, trainedDefense, trainedSupport }
}

// ── Attack AI ─────────────────────────────────────────────────────────────────

async function attackAI(npcKingdom, allKingdoms, bashMap, now, cfg) {
  if (npcKingdom.isBoss) return false
  if (NPC_AGGRESSION === 0) return false

  const personality = npcPersonality(npcKingdom)
  const cls         = npcClass(npcKingdom)
  const armySize    = [...UNIT_COMBAT_SET].reduce((s, u) => s + (npcKingdom[u] ?? 0), 0)

  const baseThreshold = ATTACK_THRESHOLD[personality]
  const threshold = baseThreshold + (cls === 'general' ? -2 : cls === 'collector' ? 3 : 0)
  if (armySize < threshold) return false

  // Cooldown: respect NPC_ATTACK_INTERVAL_HOURS between launches
  const intervalSecs = NPC_ATTACK_INTERVAL_HOURS * 3600
  const lastAttack = npcKingdom.npcLastAttackAt ?? 0
  if (now - lastAttack < intervalSecs) return false

  // Check for active attack missions from THIS specific NPC kingdom (by position)
  const activeMissions = await db.select({ id: armyMissions.id })
    .from(armyMissions)
    .where(and(
      eq(armyMissions.missionType,  'attack'),
      eq(armyMissions.state,        'active'),
      eq(armyMissions.startRealm,   npcKingdom.realm),
      eq(armyMissions.startRegion,  npcKingdom.region),
      eq(armyMissions.startSlot,    npcKingdom.slot),
    ))
  const maxMissions = cls === 'general' ? 2 : 1
  if (activeMissions.length >= maxMissions) return false

  // Search radius: discoverer can range further (+1 region)
  const radius = 1 + (cls === 'discoverer' ? 1 : 0)

  // Candidates: all kingdoms (player + NPC) except self and boss
  const atkCoord = `${npcKingdom.realm}:${npcKingdom.region}:${npcKingdom.slot}`
  const sameRegion = allKingdoms.filter(
    p => p.id !== npcKingdom.id &&
         !p.isBoss &&
         p.realm === npcKingdom.realm &&
         p.region === npcKingdom.region
  )
  const candidates = sameRegion.length > 0
    ? sameRegion
    : allKingdoms.filter(
        p => p.id !== npcKingdom.id &&
             !p.isBoss &&
             p.realm === npcKingdom.realm &&
             Math.abs(p.region - npcKingdom.region) <= radius
      )

  if (candidates.length === 0) return false

  // Min resources gate — avoid farming brand-new kingdoms
  const npcTotal = (npcKingdom.wood ?? 0) + (npcKingdom.stone ?? 0) + (npcKingdom.grain ?? 0)
  const minResources = Math.max(2000, npcTotal * 0.3)
  const eligible = candidates.filter(p => ((p.wood ?? 0) + (p.stone ?? 0) + (p.grain ?? 0)) >= minResources)
  if (eligible.length === 0) return false

  // Bash limit: skip targets this NPC has attacked too many times in last 24h
  const withinLimit = eligible.filter(p => {
    const key = `${atkCoord}→${p.realm}:${p.region}:${p.slot}`
    return (bashMap[key] ?? 0) < NPC_BASH_LIMIT
  })
  if (withinLimit.length === 0) return false

  // Weighted random selection proportional to resources (rich = more likely target)
  const totalWeight = withinLimit.reduce((s, p) => s + Math.max(1, (p.wood ?? 0) + (p.stone ?? 0) + (p.grain ?? 0)), 0)
  let rand = Math.random() * totalWeight
  let target = withinLimit[withinLimit.length - 1]
  for (const p of withinLimit) {
    rand -= Math.max(1, (p.wood ?? 0) + (p.stone ?? 0) + (p.grain ?? 0))
    if (rand <= 0) { target = p; break }
  }

  // Compose force:
  // general sends more (70-90%), economy sends less (50-70%), discoverer is moderate (55-75%)
  const minRatio = cls === 'general' ? 0.70 : personality === 'economy' ? 0.50 : 0.55
  const maxRatio = cls === 'general' ? 0.90 : personality === 'economy' ? 0.70 : 0.75
  const sendRatio = minRatio + Math.random() * (maxRatio - minRatio)

  const force = {}
  let totalSent = 0
  for (const u of UNIT_KEYS) {
    const n = npcKingdom[u] ?? 0
    if (n === 0) continue
    const send = Math.floor(n * sendRatio)
    if (send > 0) { force[u] = send; totalSent += send }
  }
  if (totalSent === 0) return false

  const universeSpeed = parseFloat(cfg.fleet_speed_war ?? 1)
  const dist       = calcDistance(npcKingdom, target)
  const npcCharClass = cls === 'general' ? 'general' : null
  const research   = npcResearch(npcKingdom)
  const travelSecs = calcDuration(dist, force, 100, universeSpeed, research, npcCharClass)
  const arrivalTime = now + travelSecs

  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'attack',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  target.realm,
    targetRegion: target.region,
    targetSlot:   target.slot,
    departureTime: now,
    arrivalTime,
    ...force,
  })

  // Deduct sent units and record attack timestamp
  const deduct = { npcLastAttackAt: now, updatedAt: new Date() }
  for (const [u, n] of Object.entries(force)) deduct[u] = (npcKingdom[u] ?? 0) - n
  await db.update(kingdoms).set(deduct).where(eq(kingdoms.id, npcKingdom.id))

  // Notify target player if human
  if (!target.isNpc && target.userId) {
    const eta = Math.round(travelSecs / 60)
    sendPush(target.userId, {
      title: '⚔️ ¡Ataque entrante!',
      body: `${npcKingdom.name} (NPC) te ataca. Llega en ~${eta} min.`,
      url: '/armies',
      tag: 'incoming-attack',
    }).catch(() => {})
  }

  return true
}

// ── Scavenge AI ───────────────────────────────────────────────────────────────
// Only NPCs that already have Carroñeros send scavenge missions.
// ~40% chance per tick. Searches debris fields in the same region.

async function scavengeAI(npcKingdom, allDebris, now, cfg) {
  const scavengerCount = npcKingdom.scavenger ?? 0
  if (scavengerCount === 0) return false

  // 40% chance to act this tick
  if (Math.random() > 0.40) return false

  // Already has an active scavenge mission from this position
  const existing = await db.select({ id: armyMissions.id }).from(armyMissions).where(and(
    eq(armyMissions.missionType, 'scavenge'),
    eq(armyMissions.state,       'active'),
    eq(armyMissions.startRealm,  npcKingdom.realm),
    eq(armyMissions.startRegion, npcKingdom.region),
    eq(armyMissions.startSlot,   npcKingdom.slot),
  )).limit(1)
  if (existing.length > 0) return false

  // Find debris fields in the same region
  const nearby = allDebris.filter(d =>
    d.realm  === npcKingdom.realm &&
    d.region === npcKingdom.region &&
    (d.wood + d.stone) > 0
  )
  if (nearby.length === 0) return false

  // Pick the richest debris field
  const target = nearby.reduce((best, d) =>
    (d.wood + d.stone) > (best.wood + best.stone) ? d : best
  )

  const force = { scavenger: scavengerCount }
  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const origin = { realm: npcKingdom.realm, region: npcKingdom.region, slot: npcKingdom.slot }
  const dest   = { realm: target.realm,     region: target.region,     slot: target.slot   }
  const dist       = calcDistance(origin, dest)
  const travelSecs = calcDuration(dist, force, 100, universeSpeed, {})
  const arrivalTime = now + travelSecs

  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'scavenge',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  target.realm,
    targetRegion: target.region,
    targetSlot:   target.slot,
    departureTime: now,
    arrivalTime,
    scavenger: scavengerCount,
  })

  // Deduct scavengers from kingdom
  await db.update(kingdoms).set({ scavenger: 0, updatedAt: new Date() })
    .where(eq(kingdoms.id, npcKingdom.id))
  npcKingdom.scavenger = 0

  return target.id  // return id so handler can remove the exact debris entry
}

// ── Expedition depletion helpers ─────────────────────────────────────────────

function depletionFactor(count) {
  return Math.max(0.3, 1 - Math.max(0, count - 3) * 0.10)
}

async function getExpeditionDepletion(now) {
  const since = now - 86400
  const rows = await db.select({
    targetRealm:  armyMissions.targetRealm,
    targetRegion: armyMissions.targetRegion,
  }).from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'expedition'),
      gte(armyMissions.departureTime, since),
    ))
  const map = {}
  for (const r of rows) {
    const key = `${r.targetRealm}:${r.targetRegion}`
    map[key] = (map[key] ?? 0) + 1
  }
  return map
}

// ── Expedition AI ─────────────────────────────────────────────────────────────

async function expeditionAI(npcKingdom, depletionMap, now, cfg) {
  if (npcKingdom.isBoss) return false
  const cls         = npcClass(npcKingdom)
  const personality = npcPersonality(npcKingdom)
  // discoverer class → strong explorer; balanced personality → moderate; rest → skip
  const probability = cls === 'discoverer' ? 0.35 : personality === 'balanced' ? 0.12 : 0
  if (probability === 0 || Math.random() > probability) return false

  // Need enough units — keep at least half the army home
  const total = totalArmy(npcKingdom)
  if (total < 20) return false

  // No active expedition already from this position
  const existing = await db.select({ id: armyMissions.id }).from(armyMissions).where(and(
    eq(armyMissions.missionType, 'expedition'),
    eq(armyMissions.startRealm,  npcKingdom.realm),
    eq(armyMissions.startRegion, npcKingdom.region),
    eq(armyMissions.startSlot,   npcKingdom.slot),
    or(eq(armyMissions.state, 'active'), eq(armyMissions.state, 'exploring')),
  )).limit(1)
  if (existing.length > 0) return false

  // Pick least-depleted region in same realm
  const REALM = npcKingdom.realm
  let bestRegion = npcKingdom.region
  let bestFactor = -1
  for (let r = 1; r <= 10; r++) {
    const count  = depletionMap[`${REALM}:${r}`] ?? 0
    const factor = depletionFactor(count)
    // Prefer higher factor; tiebreak: closer to home
    if (
      factor > bestFactor ||
      (factor === bestFactor && Math.abs(r - npcKingdom.region) < Math.abs(bestRegion - npcKingdom.region))
    ) {
      bestFactor = factor
      bestRegion = r
    }
  }

  // Send 15–25% of available units (at least 2)
  const sendRatio = 0.15 + Math.random() * 0.10
  const force = {}
  let totalSent = 0
  for (const u of UNIT_KEYS) {
    const n = npcKingdom[u] ?? 0
    if (n === 0) continue
    const send = Math.floor(n * sendRatio)
    if (send > 0) { force[u] = send; totalSent += send }
  }
  if (totalSent < 2) return false

  const holdingTime  = 1800 + Math.floor(Math.random() * 1800) // 30–60 min
  const universeSpeed = parseFloat(cfg.fleet_speed_peaceful ?? cfg.fleet_speed_war ?? 1)
  const origin = { realm: npcKingdom.realm, region: npcKingdom.region, slot: npcKingdom.slot }
  const target = { realm: REALM, region: bestRegion, slot: 16 }
  const dist        = calcDistance(origin, target)
  const research    = npcResearch(npcKingdom)
  const travelSecs  = calcDuration(dist, force, 100, universeSpeed, research, null)
  const arrivalTime = now + travelSecs

  await db.insert(armyMissions).values({
    userId:       npcKingdom.userId,
    missionType:  'expedition',
    state:        'active',
    startRealm:   npcKingdom.realm,
    startRegion:  npcKingdom.region,
    startSlot:    npcKingdom.slot,
    targetRealm:  REALM,
    targetRegion: bestRegion,
    targetSlot:   16,
    departureTime: now,
    arrivalTime,
    holdingTime,
    ...force,
  })

  const deduct = { updatedAt: new Date() }
  for (const [u, n] of Object.entries(force)) deduct[u] = (npcKingdom[u] ?? 0) - n
  await db.update(kingdoms).set(deduct).where(eq(kingdoms.id, npcKingdom.id))
  Object.assign(npcKingdom, deduct)

  // Update local depletion map so other NPCs see it this tick
  const key = `${REALM}:${bestRegion}`
  depletionMap[key] = (depletionMap[key] ?? 0) + 1

  return true
}

// ── Resolve NPC expeditions ───────────────────────────────────────────────────

async function resolveNpcExpeditions(npcUserId, npcKingdomsById, now) {
  let resolved = 0

  // 1. active → exploring (fleet arrived at slot 16)
  const arrivedActive = await db.select({ id: armyMissions.id }).from(armyMissions).where(and(
    eq(armyMissions.userId,      npcUserId),
    eq(armyMissions.missionType, 'expedition'),
    eq(armyMissions.state,       'active'),
    lte(armyMissions.arrivalTime, now),
  ))
  if (arrivedActive.length > 0) {
    await db.update(armyMissions)
      .set({ state: 'exploring', updatedAt: new Date() })
      .where(and(
        eq(armyMissions.userId,      npcUserId),
        eq(armyMissions.missionType, 'expedition'),
        eq(armyMissions.state,       'active'),
        lte(armyMissions.arrivalTime, now),
      ))
  }

  // 2. exploring → resolve → returning
  const exploring = await db.select().from(armyMissions).where(and(
    eq(armyMissions.userId,      npcUserId),
    eq(armyMissions.missionType, 'expedition'),
    eq(armyMissions.state,       'exploring'),
  ))

  if (exploring.length === 0) return resolved

  const allKingdoms = await db.select().from(kingdoms)
  const top1Points = allKingdoms.reduce((max, k) => Math.max(max, calcPoints(k)), 0)

  for (const m of exploring) {
    if (m.arrivalTime + (m.holdingTime ?? 0) > now) continue

    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (!npcKingdom) {
      await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      continue
    }

    const missionUnits = {}
    for (const k of UNIT_KEYS) missionUnits[k] = m[k] ?? 0

    const travelSecs = m.arrivalTime - m.departureTime
    const cls        = npcClass(npcKingdom)
    const isDisc     = cls === 'discoverer'

    const { outcome, result, unitPatch, returnTimeDelta, destroyed } =
      resolveExpedition(missionUnits, {}, travelSecs, now, {
        top1Points,
        combatMultiplier: isDisc ? 0.5 : 1.0,
        holdingTime: m.holdingTime ?? 0,
        discoverer: isDisc,
      })

    // NPCs skip merchant interaction (treat as resources) and ether (no wallet)
    const effectiveOutcome = (outcome === 'merchant') ? 'resources' : outcome

    const returnTime = Math.max(now + 1,
      m.arrivalTime + (m.holdingTime ?? 0) + travelSecs + (returnTimeDelta ?? 0))

    if (destroyed) {
      await db.update(armyMissions).set({
        state:  'completed',
        result: JSON.stringify({ type: 'expedition', outcome: effectiveOutcome }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, m.id))
      resolved++
      continue
    }

    const finalUnits = { ...missionUnits }
    if (unitPatch) Object.assign(finalUnits, unitPatch)

    // Resources found (from resources/bandits/demons victory)
    let woodLoad = 0, stoneLoad = 0, grainLoad = 0
    if (effectiveOutcome === 'resources' && result.found) {
      woodLoad  = result.found.wood  ?? 0
      stoneLoad = result.found.stone ?? 0
      grainLoad = result.found.grain ?? 0
    }
    // Ether → convert to grain equivalent for NPCs
    if (outcome === 'ether' && result.amount) {
      grainLoad = result.amount * 10
    }

    await db.update(armyMissions).set({
      ...finalUnits, state: 'returning',
      returnTime, woodLoad, stoneLoad, grainLoad,
      result: JSON.stringify({ type: 'expedition', outcome: effectiveOutcome }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, m.id))

    resolved++
  }

  return resolved
}

// ── Resolve NPC-vs-NPC battles ────────────────────────────────────────────────

const NPC_UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]
const NPC_DEFENSE_KEYS = [
  'archer','crossbowman','ballista','trebuchet',
  'mageTower','dragonCannon','palisade','castleWall','moat','catapult','beacon',
]
function extractK(row, keys) {
  const out = {}
  for (const k of keys) out[k] = row[k] ?? 0
  return out
}

async function resolveNpcVsNpcAttacks(npcKingdomsById, now) {
  let resolved = 0

  // Single query for all arrived attack missions targeting any NPC kingdom
  const arrivedAll = await db.select().from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'attack'),
      eq(armyMissions.state,       'active'),
      lte(armyMissions.arrivalTime, now),
    ))

  // Group by defender position and skip missions whose defender is not an NPC
  const byDefender = {}
  for (const m of arrivedAll) {
    const defKey = `${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`
    if (!npcKingdomsById[defKey]) continue
    if (!byDefender[defKey]) byDefender[defKey] = []
    byDefender[defKey].push(m)
  }

  for (const [defKey, missions] of Object.entries(byDefender)) {
    const defKingdom = npcKingdomsById[defKey]

    for (const m of missions) {
      const atkKey = `${m.startRealm}:${m.startRegion}:${m.startSlot}`
      const atkKingdom = npcKingdomsById[atkKey]
      if (!atkKingdom) continue  // player-initiated attack, handled elsewhere

      const missionUnits  = extractK(m, NPC_UNIT_KEYS)
      const atkResearch   = npcResearch(atkKingdom)
      const defResearch   = npcResearch(defKingdom)
      const attackerUnits = buildBattleUnits(missionUnits, atkResearch)
      const defenderUnits = buildBattleUnits(
        { ...extractK(defKingdom, NPC_UNIT_KEYS), ...extractK(defKingdom, NPC_DEFENSE_KEYS) }, defResearch
      )

      const { outcome, rounds, survivingAtk, lostAtk, lostDef } = runBattle(attackerUnits, defenderUnits)
      const cargo = calcCargoCapacity(missionUnits)
      const loot  = outcome === 'victory'
        ? calculateLoot({ wood: defKingdom.wood, stone: defKingdom.stone, grain: defKingdom.grain }, cargo)
        : { wood: 0, stone: 0, grain: 0 }

      const travelSecs = m.arrivalTime - m.departureTime
      const returnTime = now + travelSecs

      // Update defender NPC
      const defPatch = { updatedAt: new Date() }
      if (outcome === 'victory') {
        defPatch.wood  = Math.max(0, (defKingdom.wood  ?? 0) - loot.wood)
        defPatch.stone = Math.max(0, (defKingdom.stone ?? 0) - loot.stone)
        defPatch.grain = Math.max(0, (defKingdom.grain ?? 0) - loot.grain)
      }
      const repaired = repairDefenses(Object.fromEntries(NPC_DEFENSE_KEYS.map(k => [k, lostDef[k] ?? 0])))
      for (const k of NPC_UNIT_KEYS)    defPatch[k] = Math.max(0, (defKingdom[k] ?? 0) - (lostDef[k] ?? 0))
      for (const k of NPC_DEFENSE_KEYS) defPatch[k] = Math.max(0, (defKingdom[k] ?? 0) - (lostDef[k] ?? 0) + (repaired[k] ?? 0))
      await db.update(kingdoms).set(defPatch).where(eq(kingdoms.id, defKingdom.id))
      Object.assign(defKingdom, defPatch)

      // Update attacker mission
      if (outcome === 'victory') {
        const survivorPatch = {}
        for (const k of NPC_UNIT_KEYS) survivorPatch[k] = survivingAtk[k] ?? 0
        await db.update(armyMissions).set({
          ...survivorPatch, state: 'returning', returnTime,
          woodLoad: loot.wood, stoneLoad: loot.stone, grainLoad: loot.grain,
          updatedAt: new Date(),
        }).where(eq(armyMissions.id, m.id))
      } else {
        await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      }

      await insertBattleLog({
        attackerKingdomId: atkKingdom.id, attackerName: atkKingdom.name, attackerIsNpc: true,
        defenderKingdomId: defKingdom.id, defenderName: defKingdom.name, defenderIsNpc: true,
        missionType: 'attack', outcome,
        lootWood: loot.wood, lootStone: loot.stone, lootGrain: loot.grain,
        attackerLosses: sumLosses(lostAtk), defenderLosses: sumLosses(lostDef), rounds,
        attackerCoord: atkKey,
        defenderCoord: `${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`,
      })

      resolved++
    }
  }
  return resolved
}

// ── Process NPC return missions ───────────────────────────────────────────────

async function processNpcReturns(npcUserId, npcKingdomsById, now) {
  const returning = await db.select().from(armyMissions)
    .where(and(
      eq(armyMissions.userId, npcUserId),
      eq(armyMissions.state,  'returning'),
      lte(armyMissions.returnTime, now),
    ))

  for (const m of returning) {
    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (!npcKingdom) {
      await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      continue
    }

    const patch = { updatedAt: new Date() }
    for (const u of UNIT_KEYS) {
      const n = m[u] ?? 0
      if (n > 0) patch[u] = (npcKingdom[u] ?? 0) + n
    }
    if ((m.woodLoad  ?? 0) > 0) patch.wood  = Math.min((npcKingdom.wood  ?? 0) + m.woodLoad,  npcKingdom.woodCapacity)
    if ((m.stoneLoad ?? 0) > 0) patch.stone = Math.min((npcKingdom.stone ?? 0) + m.stoneLoad, npcKingdom.stoneCapacity)
    if ((m.grainLoad ?? 0) > 0) patch.grain = Math.min((npcKingdom.grain ?? 0) + m.grainLoad, npcKingdom.grainCapacity)

    await db.update(kingdoms).set(patch).where(eq(kingdoms.id, npcKingdom.id))

    // Expeditions are kept as 'completed' for the admin log; others are deleted.
    if (m.missionType === 'expedition') {
      await db.update(armyMissions)
        .set({ state: 'completed', updatedAt: new Date() })
        .where(eq(armyMissions.id, m.id))
    } else {
      await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
    }
    Object.assign(npcKingdom, patch)
  }
}

// ── Purge old completed expeditions (>7 days) to prevent table bloat ─────────

async function purgeOldExpeditions(now) {
  const cutoff = now - 7 * 86400
  const { rowCount } = await db.delete(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'expedition'),
      eq(armyMissions.state,       'completed'),
      lt(armyMissions.departureTime, cutoff),
    ))
  return rowCount ?? 0
}

// ── Season auto-management ────────────────────────────────────────────────────

async function manageSeason(cfg, now) {
  const seasonState  = cfg.season_state  ?? null
  const seasonEnd    = parseInt(cfg.season_end ?? '0', 10)
  const seasonNumber = parseInt(cfg.season_number ?? '0', 10)

  if (!seasonState || seasonState === '') {
    const result = await startNewSeason(1, cfg.economy_speed)
    return { action: 'bootstrap', season: 1, ...result }
  }

  if (seasonState === 'active' && seasonEnd > 0 && now > seasonEnd) {
    const winnerCondition = cfg.season_winner_condition ?? ''
    if (!winnerCondition || winnerCondition === '') {
      await setSetting('season_winner_condition', 'points')
    }
    const nextNumber = seasonNumber + 1
    const result = await startNewSeason(nextNumber, cfg.economy_speed)
    return { action: 'transition', from: seasonNumber, to: nextNumber, ...result }
  }

  return null
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const now = Math.floor(Date.now() / 1000)
  const cfg = await getSettings()

  // Auto-manage season (bootstrap + transitions)
  const seasonAction = await manageSeason(cfg, now)

  // Self-heal: if season is 'active' but NPC kingdoms are missing
  // (e.g. a previous startNewSeason crashed mid-way, or the settings flag was
  // flipped manually), reseed NPCs without touching player or boss kingdoms.
  const repairAction = await repairSeasonNpcsIfMissing(now)

  // Load NPC system user
  const [npcUser] = await db.select({ id: users.id })
    .from(users).where(eq(users.isNpc, true)).limit(1)
  if (!npcUser) return res.json({ ok: true, skipped: 'no_npc_user', seasonAction, repairAction })

  const npcUserId = npcUser.id

  // Load all NPC kingdoms
  const npcKingdoms = await db.select().from(kingdoms)
    .where(eq(kingdoms.isNpc, true))

  if (npcKingdoms.length === 0) return res.json({ ok: true, skipped: 'no_npc_kingdoms', seasonAction, repairAction })

  // Build lookup map by position
  const npcKingdomsById = {}
  for (const k of npcKingdoms) npcKingdomsById[`${k.realm}:${k.region}:${k.slot}`] = k

  // Load all player kingdoms for attack target selection
  const playerKingdoms = await db.select({
    id: kingdoms.id, userId: kingdoms.userId, name: kingdoms.name,
    isNpc: kingdoms.isNpc, isBoss: kingdoms.isBoss,
    realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
    wood: kingdoms.wood, stone: kingdoms.stone, grain: kingdoms.grain,
  }).from(kingdoms).where(eq(kingdoms.isNpc, false))

  // All kingdoms (player + NPC) as attack targets, excluding the boss
  const allKingdoms = [
    ...playerKingdoms,
    ...npcKingdoms.map(k => ({
      id: k.id, userId: k.userId, name: k.name,
      isNpc: true, isBoss: k.isBoss ?? false,
      realm: k.realm, region: k.region, slot: k.slot,
      wood: k.wood, stone: k.stone, grain: k.grain,
    })),
  ]

  // Bash map: count attacks from each NPC position to each target in last 24h
  const recentAttacks = await db.select({
    startRealm: armyMissions.startRealm, startRegion: armyMissions.startRegion, startSlot: armyMissions.startSlot,
    targetRealm: armyMissions.targetRealm, targetRegion: armyMissions.targetRegion, targetSlot: armyMissions.targetSlot,
  }).from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'attack'),
      gte(armyMissions.createdAt,  new Date(Date.now() - 24 * 3600 * 1000)),
    ))
  const bashMap = {}
  for (const r of recentAttacks) {
    const key = `${r.startRealm}:${r.startRegion}:${r.startSlot}→${r.targetRealm}:${r.targetRegion}:${r.targetSlot}`
    bashMap[key] = (bashMap[key] ?? 0) + 1
  }

  // Load all debris fields once for scavenge AI
  const allDebris = await db.select({
    id: debrisFields.id, realm: debrisFields.realm, region: debrisFields.region, slot: debrisFields.slot,
    wood: debrisFields.wood, stone: debrisFields.stone,
  }).from(debrisFields)

  // ── Process NPC return missions first ──────────────────────────────────────
  await processNpcReturns(npcUserId, npcKingdomsById, now)

  // ── Resolve arrived NPC scavenge missions ─────────────────────────────────
  const arrivedScavenges = await db.select().from(armyMissions).where(and(
    eq(armyMissions.userId,      npcUserId),
    eq(armyMissions.missionType, 'scavenge'),
    eq(armyMissions.state,       'active'),
    lte(armyMissions.arrivalTime, now),
  ))
  for (const m of arrivedScavenges) {
    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (npcKingdom) await processScavenge(m, npcKingdom, now, null)
  }

  // ── Resolve arrived NPC-vs-NPC battles ────────────────────────────────────
  const npcVsNpcResolved = await resolveNpcVsNpcAttacks(npcKingdomsById, now)

  // ── Resolve NPC expeditions (active→exploring→returning) ─────────────────
  const npcExpeditionsResolved = await resolveNpcExpeditions(npcUserId, npcKingdomsById, now)

  // ── Load expedition depletion map for this tick ───────────────────────────
  const depletionMap = await getExpeditionDepletion(now)

  // ── Per-NPC tick, growth, attack, scavenge and expedition ─────────────────
  let ticked = 0, builtBuilding = 0, trainedCombat = 0, trainedDefense = 0, trainedSupport = 0
  let attacked = 0, scavenged = 0, expeditioned = 0

  for (const kingdom of npcKingdoms) {
    try {
      // Resource tick — pass npcClass so tick.js applies collector +25% via same path as players
      const cls = npcClass(kingdom)
      const tickResult = applyResourceTick(kingdom, cfg, cls === 'collector' ? 'collector' : null)
      const finalWood  = tickResult.wood
      const finalStone = tickResult.stone
      const finalGrain = tickResult.grain

      if (
        finalWood  !== kingdom.wood ||
        finalStone !== kingdom.stone ||
        finalGrain !== kingdom.grain
      ) {
        await db.update(kingdoms).set({
          wood:               finalWood,
          stone:              finalStone,
          grain:              finalGrain,
          lastResourceUpdate: now,
          updatedAt:          new Date(),
        }).where(eq(kingdoms.id, kingdom.id))
        kingdom.wood               = finalWood
        kingdom.stone              = finalStone
        kingdom.grain              = finalGrain
        kingdom.lastResourceUpdate = now
        ticked++
      }

      // Growth AI — returns what actions were taken
      const growResult = await growNpc(kingdom, cfg, now)
      if (growResult?.builtBuilding) builtBuilding++
      if (growResult?.trainedCombat)  trainedCombat++
      if (growResult?.trainedDefense) trainedDefense++
      if (growResult?.trainedSupport) trainedSupport++

      // Attack AI
      if (NPC_AGGRESSION > 0 && allKingdoms.length > 1) {
        const launched = await attackAI(kingdom, allKingdoms, bashMap, now, cfg)
        if (launched) attacked++
      }

      // Scavenge AI — returns claimed debris id or falsy
      const claimedDebrisId = await scavengeAI(kingdom, allDebris, now, cfg)
      if (claimedDebrisId) {
        scavenged++
        const idx = allDebris.findIndex(d => d.id === claimedDebrisId)
        if (idx >= 0) allDebris.splice(idx, 1)
      }

      // Expedition AI
      const didExpedition = await expeditionAI(kingdom, depletionMap, now, cfg)
      if (didExpedition) expeditioned++
    } catch (err) {
      console.error(`[npc-tick] kingdom ${kingdom.id} error:`, err?.message ?? err)
    }
  }

  // ── Purge completed expeditions older than 7 days ─────────────────────────
  const purged = await purgeOldExpeditions(now)

  // ── Debug breakdown ────────────────────────────────────────────────────────
  const byPersonality = { economy: 0, military: 0, balanced: 0 }
  const byClass = { collector: 0, general: 0, discoverer: 0 }
  for (const k of npcKingdoms) {
    byPersonality[npcPersonality(k)]++
    byClass[npcClass(k)]++
  }

  // ── Persist tick result for admin monitor ─────────────────────────────────
  const tickResult = {
    at: now,
    npcCount: npcKingdoms.length, ticked,
    builtBuilding, trainedCombat, trainedDefense, trainedSupport,
    attacked, scavenged, expeditioned, npcExpeditionsResolved, npcVsNpcResolved, purged,
  }
  const MAX_HISTORY = 48
  let history = []
  try {
    const raw = cfg.npc_tick_history
    if (raw) history = JSON.parse(raw)
  } catch { history = [] }
  history.push(tickResult)
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY)
  await Promise.all([
    setSetting('npc_last_tick',    JSON.stringify(tickResult)),
    setSetting('npc_tick_history', JSON.stringify(history)),
  ])

  return res.json({ ok: true, ...tickResult, byPersonality, byClass, seasonAction, repairAction })
}
