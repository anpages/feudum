import { eq, inArray } from 'drizzle-orm'
import { db, kingdoms, users, npcState, buildings, units, research, armyMissions } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { getStringSetting, getSettings } from '../lib/settings.js'

const ALL_BUILDINGS = [
  'sawmill','quarry','grainFarm','windmill','cathedral',
  'workshop','engineersGuild','barracks','academy',
  'granary','stonehouse','silo',
  'alchemistTower','ambassadorHall','armoury',
]

const ALL_RESEARCH = [
  'alchemy','pyromancy','runemastery','mysticism','dragonlore',
  'fortification','swordsmanship','armoury',
  'horsemanship','cartography','tradeRoutes','logistics',
  'spycraft','exploration','diplomaticNetwork',
]

const MOBILE_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]
const COMBAT_KEYS  = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']
const SUPPORT_KEYS = ['merchant','caravan','scavenger']
const DEFENSE_KEYS = ['archer','crossbowman','ballista','trebuchet','mageTower','dragonCannon','castleWall','moat','catapult']

function avg(arr, fn) {
  if (!arr.length) return 0
  return arr.reduce((s, x) => s + (fn(x) ?? 0), 0) / arr.length
}
function sum(arr, fn) {
  return arr.reduce((s, x) => s + (fn(x) ?? 0), 0)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  const now = Math.floor(Date.now() / 1000)

  // Load tick history from settings for all 3 crons
  const cfg = await getSettings()
  function parseTick(raw)    { try { return raw ? JSON.parse(raw) : null  } catch { return null  } }
  function parseHistory(raw) { try { return raw ? JSON.parse(raw) : []    } catch { return []    } }

  const lastTick    = parseTick(cfg.npc_last_tick)
  const tickHistory = parseHistory(cfg.npc_tick_history)

  const crons = {
    builder: {
      lastTick:    lastTick,
      tickHistory: tickHistory.slice(-48),
    },
    combat: {
      lastTick:    parseTick(cfg.combat_engine_last_tick),
      tickHistory: parseHistory(cfg.combat_engine_tick_history).slice(-48),
    },
    militaryAi: {
      lastTick:    parseTick(cfg.military_ai_last_tick),
      tickHistory: parseHistory(cfg.military_ai_tick_history).slice(-48),
    },
  }

  // Load NPC kingdoms + npcState
  const npcRows = await db.select({ k: kingdoms, ns: npcState })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .leftJoin(npcState, eq(kingdoms.userId, npcState.userId))
    .where(eq(users.role, 'npc'))

  const npcKingdomIds = npcRows.map(r => r.k.id)
  const npcUserIds    = npcRows.map(r => r.k.userId)

  // Batch load buildings, units, and research
  const [allBuildings, allUnits, allResearch] = await Promise.all([
    npcKingdomIds.length
      ? db.select().from(buildings).where(inArray(buildings.kingdomId, npcKingdomIds))
      : [],
    npcKingdomIds.length
      ? db.select().from(units).where(inArray(units.kingdomId, npcKingdomIds))
      : [],
    npcUserIds.length
      ? db.select().from(research).where(inArray(research.userId, npcUserIds))
      : [],
  ])

  // Build lookup maps
  const buildingsByKingdom = {}
  for (const b of allBuildings) {
    if (!buildingsByKingdom[b.kingdomId]) buildingsByKingdom[b.kingdomId] = {}
    buildingsByKingdom[b.kingdomId][b.type] = b.level
  }
  const unitsByKingdom = {}
  for (const u of allUnits) {
    if (!unitsByKingdom[u.kingdomId]) unitsByKingdom[u.kingdomId] = {}
    unitsByKingdom[u.kingdomId][u.type] = u.quantity
  }

  const researchByUser = {}
  for (const r of allResearch) {
    if (!researchByUser[r.userId]) researchByUser[r.userId] = {}
    researchByUser[r.userId][r.type] = r.level
  }

  // Enrich kingdoms — merge buildings, units, research, and npcState
  const allRows = npcRows.map(({ k, ns }) => ({
    ...k,
    ...(buildingsByKingdom[k.id] ?? {}),
    ...(unitsByKingdom[k.id] ?? {}),
    _research: researchByUser[k.userId] ?? {},
    isBoss:   ns?.isBoss   ?? false,
    npcLevel: ns?.npcLevel ?? 1,
  }))

  const npcs = allRows.filter(r => !r.isBoss)
  const boss = allRows.filter(r => r.isBoss)

  // Load missions for all NPC users
  const missions = npcUserIds.length
    ? await db.select({
        missionType: armyMissions.missionType,
        state:       armyMissions.state,
      }).from(armyMissions).where(inArray(armyMissions.userId, npcUserIds))
    : []

  const missionCounts = {}
  for (const m of missions) {
    const k = `${m.missionType}:${m.state}`
    missionCounts[k] = (missionCounts[k] ?? 0) + 1
  }

  // Aggregate stats
  const mobileArmy = n => MOBILE_KEYS.reduce((s, k) => s + (n[k] ?? 0), 0)
  const combatArmy = n => COMBAT_KEYS.reduce((s, k) => s + (n[k] ?? 0), 0)
  const supportUnits = n => SUPPORT_KEYS.reduce((s, k) => s + (n[k] ?? 0), 0)

  const withArmy   = npcs.filter(n => mobileArmy(n) > 0).length
  const withMerchant  = npcs.filter(n => (n.merchant  ?? 0) > 0).length
  const withCaravan   = npcs.filter(n => (n.caravan   ?? 0) > 0).length
  const withScavenger = npcs.filter(n => (n.scavenger ?? 0) > 0).length

  // Building avg/max for all 15 buildings
  const buildingStats = {}
  for (const b of ALL_BUILDINGS) {
    const cap = b.charAt(0).toUpperCase() + b.slice(1)
    buildingStats[`avg${cap}`] = parseFloat(avg(npcs, n => n[b]).toFixed(1))
    buildingStats[`max${cap}`] = npcs.reduce((m, n) => Math.max(m, n[b] ?? 0), 0)
  }

  // Research avg/max for all research types
  const researchStats = {}
  for (const r of ALL_RESEARCH) {
    const cap = r.charAt(0).toUpperCase() + r.slice(1)
    researchStats[`avg${cap}`] = parseFloat(avg(npcs, n => n._research[r] ?? 0).toFixed(1))
    researchStats[`max${cap}`] = npcs.reduce((m, n) => Math.max(m, n._research[r] ?? 0), 0)
    researchStats[`with${cap}`] = npcs.filter(n => (n._research[r] ?? 0) > 0).length
  }

  const aggregate = {
    total:   npcs.length,
    bosses:  boss.length,
    withArmy,
    withMerchant,
    withCaravan,
    withScavenger,

    ...buildingStats,
    researchStats,

    avgArmy:      parseFloat(avg(npcs, mobileArmy).toFixed(1)),
    maxArmy:      npcs.reduce((m, n) => Math.max(m, mobileArmy(n)), 0),
    totalSquire:  sum(npcs, n => n.squire),
    totalMerchant:  sum(npcs, n => n.merchant),
    totalCaravan:   sum(npcs, n => n.caravan),
    totalScavenger: sum(npcs, n => n.scavenger),

    avgWood:   Math.round(avg(npcs, n => n.wood)),
    avgStone:  Math.round(avg(npcs, n => n.stone)),
    avgGrain:  Math.round(avg(npcs, n => n.grain)),

    // Army size distribution buckets
    armyDistribution: {
      '0':    npcs.filter(n => mobileArmy(n) === 0).length,
      '1-10': npcs.filter(n => { const a = mobileArmy(n); return a >= 1 && a <= 10 }).length,
      '11-50':  npcs.filter(n => { const a = mobileArmy(n); return a >= 11 && a <= 50 }).length,
      '51-200': npcs.filter(n => { const a = mobileArmy(n); return a >= 51 && a <= 200 }).length,
      '200+':   npcs.filter(n => mobileArmy(n) > 200).length,
    },

    // Per-type combat unit totals
    totalKnight:      sum(npcs, n => n.knight),
    totalPaladin:     sum(npcs, n => n.paladin),
    totalWarlord:     sum(npcs, n => n.warlord),
    totalGrandKnight: sum(npcs, n => n.grandKnight),
    totalSiegeMaster: sum(npcs, n => n.siegeMaster),
    totalWarMachine:  sum(npcs, n => n.warMachine),
    totalDragonKnight: sum(npcs, n => n.dragonKnight),
    withKnight:       npcs.filter(n => (n.knight      ?? 0) > 0).length,
    withPaladin:      npcs.filter(n => (n.paladin     ?? 0) > 0).length,
    withWarlord:      npcs.filter(n => (n.warlord     ?? 0) > 0).length,
    withGrandKnight:  npcs.filter(n => (n.grandKnight ?? 0) > 0).length,

    // Defense unit totals
    ...DEFENSE_KEYS.reduce((acc, k) => {
      const cap = k.charAt(0).toUpperCase() + k.slice(1)
      acc[`total${cap}`] = sum(npcs, n => n[k])
      acc[`with${cap}`]  = npcs.filter(n => (n[k] ?? 0) > 0).length
      return acc
    }, {}),

    missionCounts,
    now,
  }

  return res.json({ crons, lastTick, tickHistory: tickHistory.slice(-24), aggregate })
}
