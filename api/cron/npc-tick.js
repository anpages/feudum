/**
 * NPC hourly cron — resource tick + growth AI + attack AI + return processing.
 * Called by Vercel Cron: schedule "0 * * * *"
 * Secured with CRON_SECRET header.
 */
import { eq, and, lte, gte } from 'drizzle-orm'
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
    sawmill: 1.0, quarry: 0.85, grainFarm: 0.70, windmill: 0.60,
    cathedral: 0.50, granary: 0.55, stonehouse: 0.50, silo: 0.45,
    workshop: 0.65, barracks: 0.60, academy: 0.25,
    alchemistTower: 0.40, ambassadorHall: 0.20, armoury: 0.35, engineersGuild: 0.35,
  },
  military: {
    barracks: 1.0, sawmill: 0.75, quarry: 0.65, workshop: 0.60,
    grainFarm: 0.55, windmill: 0.45, armoury: 0.50, granary: 0.35,
    stonehouse: 0.35, silo: 0.30, academy: 0.25,
    alchemistTower: 0.25, ambassadorHall: 0.30, cathedral: 0.20, engineersGuild: 0.25,
  },
  balanced: {
    sawmill: 0.90, barracks: 0.80, quarry: 0.75, grainFarm: 0.65,
    windmill: 0.55, workshop: 0.60, granary: 0.45, stonehouse: 0.40,
    silo: 0.35, academy: 0.30, alchemistTower: 0.35,
    armoury: 0.35, ambassadorHall: 0.25, cathedral: 0.30, engineersGuild: 0.30,
  },
}

// ── Unit training priority per personality (no cap, ordered by preference) ───
// Mobile units (squire, knight, …) come first so totalArmy() reaches attack
// threshold. Defenses (archer, crossbowman, …) are still trained but secondary.
const UNIT_PRIORITY = {
  economy:  ['squire', 'archer', 'crossbowman', 'knight', 'mageTower', 'ballista', 'paladin', 'warlord', 'grandKnight', 'siegeMaster', 'warMachine', 'dragonKnight'],
  military: ['squire', 'knight', 'archer', 'crossbowman', 'paladin', 'warlord', 'ballista', 'mageTower', 'grandKnight', 'siegeMaster', 'warMachine', 'dragonKnight'],
  balanced: ['squire', 'archer', 'knight', 'crossbowman', 'paladin', 'mageTower', 'ballista', 'warlord', 'grandKnight', 'siegeMaster', 'warMachine', 'dragonKnight'],
}

// ── Attack threshold per personality (min MOBILE army units before attacking) ─
const ATTACK_THRESHOLD = {
  economy:  8,
  military: 5,
  balanced: 6,
}

// ── Unit costs (wood/stone to train one unit) ─────────────────────────────────
const UNIT_COSTS = {
  squire:      { wood: 3000,    stone: 1000   },
  archer:      { wood: 2000,    stone: 0      },
  crossbowman: { wood: 1500,    stone: 500    },
  knight:      { wood: 6000,    stone: 4000   },
  ballista:    { wood: 6000,    stone: 2000   },
  mageTower:   { wood: 2000,    stone: 6000   },
  paladin:     { wood: 20000,   stone: 7000   },
  warlord:     { wood: 45000,   stone: 15000  },
  grandKnight: { wood: 30000,   stone: 40000  },
  siegeMaster: { wood: 50000,   stone: 25000  },
  warMachine:  { wood: 60000,   stone: 50000  },
  dragonKnight:{ wood: 5000000, stone: 4000000},
}

const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

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

  const buildAvailable = kingdom.npcBuildAvailableAt ?? 0
  const canBuild = now >= buildAvailable

  let { wood, stone, grain } = kingdom
  let patch = {}

  // ── Building upgrade ───────────────────────────────────────────────────────
  if (canBuild) {
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
      // Skip if building requirements are not met
      if (def.requires?.length) {
        const blocked = def.requires.some(req => {
          if (req.type !== 'building') return false
          return ((patch[req.id] ?? kingdom[req.id] ?? 0)) < req.level
        })
        if (blocked) continue
      }

      const nextLv = currentLv + 1
      const cost = buildCost(def.woodBase, def.stoneBase, def.factor, nextLv - 1, def.grainBase ?? 0)

      if (wood >= cost.wood && stone >= cost.stone && grain >= (cost.grain ?? 0)) {
        wood  -= cost.wood
        stone -= cost.stone
        grain -= (cost.grain ?? 0)

        const effect = applyBuildingEffect(id, nextLv, { ...kingdom, ...patch })
        Object.assign(patch, effect)

        const workshopLv       = (patch.workshop       ?? kingdom.workshop)       ?? 0
        const engineersGuildLv = (patch.engineersGuild ?? kingdom.engineersGuild) ?? 0
        const rawTime  = buildTime(cost.wood, cost.stone, nextLv, workshopLv, engineersGuildLv, speed)
        // Boss builds 2× faster; discoverer gets 0.75×
        const timeBonus = isBoss ? 0.5 : (cls === 'discoverer' ? 0.75 : 1.0)
        patch.npcBuildAvailableAt = now + Math.max(30, Math.floor(rawTime * timeBonus))
        break
      }
    }
  }

  // ── Unit training ──────────────────────────────────────────────────────────
  const barracksLv   = (patch.barracks ?? kingdom.barracks) ?? 0
  // Boss trains up to 3 unit types and 200 units per type; general trains 2 types, 50 units
  const maxUnitTypes = isBoss ? 3 : (cls === 'general' ? 2 : 1)
  const batchCap     = isBoss ? 200 : 50
  const costMult     = (isBoss || cls === 'general') ? 0.9 : 1.0
  let unitTypesTrained = 0

  const researchLevels = npcResearch({ ...kingdom, ...patch })

  for (const unitId of UNIT_PRIORITY[personality]) {
    if (unitTypesTrained >= maxUnitTypes) break

    const unitDef = ALL_UNITS.find(u => u.id === unitId)
    if (!unitDef) continue

    // Check building + research requirements using virtual research
    if (unitDef.requires?.length) {
      const blocked = unitDef.requires.some(req => {
        if (req.type === 'building') return ((patch[req.id] ?? kingdom[req.id] ?? 0)) < req.level
        if (req.type === 'research') return (researchLevels[req.id] ?? 0) < req.level
        return false
      })
      if (blocked) continue
    }

    const cost = UNIT_COSTS[unitId]
    if (!cost) continue

    const effWood  = Math.ceil(cost.wood  * costMult)
    const effStone = Math.ceil(cost.stone * costMult)
    if (effWood > wood || effStone > stone) continue

    const canAfford = Math.min(
      effWood  > 0 ? Math.floor(wood  / effWood)  : Infinity,
      effStone > 0 ? Math.floor(stone / effStone) : Infinity,
    )
    if (canAfford <= 0) continue

    const batch = Math.min(canAfford, batchCap)
    wood  -= effWood  * batch
    stone -= effStone * batch
    patch[unitId] = (kingdom[unitId] ?? 0) + batch
    unitTypesTrained++
  }

  if (Object.keys(patch).length === 0) return

  await db.update(kingdoms).set({
    ...patch,
    wood, stone, grain,
    lastResourceUpdate: now,
    updatedAt: new Date(),
  }).where(eq(kingdoms.id, kingdom.id))
}

// ── Attack AI ─────────────────────────────────────────────────────────────────

async function attackAI(npcKingdom, allKingdoms, bashMap, now, cfg) {
  if (NPC_AGGRESSION === 0) return false

  const personality = npcPersonality(npcKingdom)
  const cls         = npcClass(npcKingdom)
  const armySize    = totalArmy(npcKingdom)

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
  const minRatio = cls === 'general' ? 0.70 : cls === 'economy' || personality === 'economy' ? 0.50 : 0.55
  const maxRatio = cls === 'general' ? 0.90 : cls === 'economy' || personality === 'economy' ? 0.70 : 0.75
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

  return true
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
  for (const defKingdom of Object.values(npcKingdomsById)) {
    const arrivedMissions = await db.select().from(armyMissions)
      .where(and(
        eq(armyMissions.missionType, 'attack'),
        eq(armyMissions.state,       'active'),
        eq(armyMissions.targetRealm,  defKingdom.realm),
        eq(armyMissions.targetRegion, defKingdom.region),
        eq(armyMissions.targetSlot,   defKingdom.slot),
        lte(armyMissions.arrivalTime, now),
      ))

    for (const m of arrivedMissions) {
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
    await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
    Object.assign(npcKingdom, patch)
  }
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
      await setSetting('season_state', 'ended')
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

  // ── Process NPC return missions first ──────────────────────────────────────
  await processNpcReturns(npcUserId, npcKingdomsById, now)

  // ── Resolve arrived NPC-vs-NPC battles ────────────────────────────────────
  const npcVsNpcResolved = await resolveNpcVsNpcAttacks(npcKingdomsById, now)

  // ── Per-NPC tick, growth, and attack ──────────────────────────────────────
  let ticked = 0, grew = 0, attacked = 0

  for (const kingdom of npcKingdoms) {
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

    // Growth AI
    await growNpc(kingdom, cfg, now)
    grew++

    // Attack AI
    if (NPC_AGGRESSION > 0 && allKingdoms.length > 1) {
      const launched = await attackAI(kingdom, allKingdoms, bashMap, now, cfg)
      if (launched) attacked++
    }
  }

  // ── Debug breakdown ────────────────────────────────────────────────────────
  const byPersonality = { economy: 0, military: 0, balanced: 0 }
  const byClass = { collector: 0, general: 0, discoverer: 0 }
  for (const k of npcKingdoms) {
    byPersonality[npcPersonality(k)]++
    byClass[npcClass(k)]++
  }

  return res.json({ ok: true, npcCount: npcKingdoms.length, ticked, grew, attacked, npcVsNpcResolved, byPersonality, byClass, seasonAction, repairAction })
}
