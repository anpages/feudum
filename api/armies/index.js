import { eq, and } from 'drizzle-orm'
import { db, kingdoms, users, armyMissions, research } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import {
  buildBattleUnits, runBattle, calculateLoot,
  calculateDebris, repairDefenses, calcCargoCapacity, UNIT_STATS,
} from '../lib/battle.js'

const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]
const DEFENSE_KEYS = [
  'archer','crossbowman','ballista','trebuchet',
  'mageTower','dragonCannon','palisade','castleWall',
]
const ALL_UNIT_KEYS = [...UNIT_KEYS, ...DEFENSE_KEYS]

function extractUnits(row, keys) {
  const out = {}
  for (const k of keys) out[k] = row[k] ?? 0
  return out
}

// ── Lazy mission processor ────────────────────────────────────────────────────

async function processMissions(userId, kingdom) {
  const now      = Math.floor(Date.now() / 1000)
  const missions = await db.select().from(armyMissions)
    .where(eq(armyMissions.userId, userId))

  for (const m of missions) {
    if (m.state === 'active' && m.arrivalTime <= now) {
      await processArrival(m, kingdom, now)
    } else if (m.state === 'returning' && m.returnTime && m.returnTime <= now) {
      await processReturn(m, kingdom, now)
    }
  }
}

async function processArrival(mission, myKingdom, now) {
  const travelSecs = mission.arrivalTime - mission.departureTime
  const returnTime = now + travelSecs
  const mType      = mission.missionType

  const missionUnits = extractUnits(mission, UNIT_KEYS)

  // ── Spy ──────────────────────────────────────────────────────────────────────
  if (mType === 'spy') {
    await db.update(armyMissions).set({
      state: 'returning', returnTime,
      result: JSON.stringify({ type: 'spy', message: 'Explorador regresa sin ser detectado.' }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
    return
  }

  // Resolve target kingdom
  const [targetKingdom] = await db
    .select().from(kingdoms)
    .where(and(
      eq(kingdoms.realm,  mission.targetRealm),
      eq(kingdoms.region, mission.targetRegion),
      eq(kingdoms.slot,   mission.targetSlot),
    )).limit(1)

  // ── Transport ─────────────────────────────────────────────────────────────────
  if (mType === 'transport') {
    if (targetKingdom) {
      await db.update(kingdoms).set({
        wood:  Math.min(targetKingdom.wood  + mission.woodLoad,  targetKingdom.woodCapacity),
        stone: Math.min(targetKingdom.stone + mission.stoneLoad, targetKingdom.stoneCapacity),
        grain: Math.min(targetKingdom.grain + mission.grainLoad, targetKingdom.grainCapacity),
        updatedAt: new Date(),
      }).where(eq(kingdoms.id, targetKingdom.id))
      await db.update(armyMissions).set({
        state: 'returning', returnTime, woodLoad: 0, stoneLoad: 0, grainLoad: 0,
        result: JSON.stringify({ type: 'transport', delivered: true }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))
    } else {
      await db.update(armyMissions).set({
        state: 'returning', returnTime,
        result: JSON.stringify({ type: 'transport', delivered: false, reason: 'No hay reino en el destino' }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))
    }
    return
  }

  // ── Attack ────────────────────────────────────────────────────────────────────
  if (mType === 'attack') {
    // Fetch attacker research for combat bonuses
    const [atkResearch] = await db.select().from(research)
      .where(eq(research.userId, myKingdom.userId)).limit(1)

    // Build attacker units
    const attackerUnits = buildBattleUnits(missionUnits, atkResearch ?? {})

    let defenderUnits = []
    let defRes        = { wood: 0, stone: 0, grain: 0 }

    if (targetKingdom) {
      // Fetch defender research
      const [defResearch] = await db.select().from(research)
        .where(eq(research.userId, targetKingdom.userId)).limit(1)

      const defUnitCounts    = extractUnits(targetKingdom, UNIT_KEYS)
      const defDefenseCounts = extractUnits(targetKingdom, DEFENSE_KEYS)

      defenderUnits = buildBattleUnits(
        { ...defUnitCounts, ...defDefenseCounts },
        defResearch ?? {}
      )
      defRes = { wood: targetKingdom.wood, stone: targetKingdom.stone, grain: targetKingdom.grain }
    } else {
      // NPC — generate a small defending force based on seed
      const seed  = mission.targetRealm * 374761397 + mission.targetRegion * 1234567 + mission.targetSlot * 7654321
      const npcPts = ((seed ^ (seed >>> 16)) >>> 0) % 20000  // 0–20000 pts
      const archers = 5 + Math.floor(npcPts / 2000)
      const ballistas = Math.floor(npcPts / 5000)
      defenderUnits = buildBattleUnits({ archer: archers, ballista: ballistas }, {})
      defRes = { wood: 1000 + npcPts / 10, stone: 800 + npcPts / 12, grain: 600 + npcPts / 15 }
    }

    // Run battle engine
    const { outcome, rounds, survivingAtk, lostAtk, lostDef } =
      runBattle(attackerUnits, defenderUnits)

    // Debris from all lost units
    const debris = calculateDebris(lostAtk, lostDef)

    if (outcome === 'victory' || outcome === 'draw') {
      const cargo    = calcCargoCapacity(missionUnits)
      const loot     = outcome === 'victory' ? calculateLoot(defRes, cargo) : { wood: 0, stone: 0, grain: 0 }

      if (targetKingdom && outcome === 'victory') {
        // Deduct loot from defender, restore repaired defenses
        const defLostDefenses = {}
        for (const k of DEFENSE_KEYS) defLostDefenses[k] = lostDef[k] ?? 0
        const repaired = repairDefenses(defLostDefenses)

        const defPatch = { updatedAt: new Date() }
        defPatch.wood  = Math.max(0, targetKingdom.wood  - loot.wood)
        defPatch.stone = Math.max(0, targetKingdom.stone - loot.stone)
        defPatch.grain = Math.max(0, targetKingdom.grain - loot.grain)

        // Restore surviving defender units
        for (const k of UNIT_KEYS) {
          defPatch[k] = survivingAtk[k] !== undefined  // not attacker's survivors
            ? (targetKingdom[k] ?? 0)
            : (survivingAtk[k] ?? targetKingdom[k] ?? 0)
        }
        // Surviving defender units (those still standing after battle)
        for (const k of UNIT_KEYS) defPatch[k] = targetKingdom[k] ?? 0  // reset
        // Actually we need defender survivors — let me recalc below

        // surviving defender units: original - lost + repaired (for defenses)
        for (const k of UNIT_KEYS) {
          defPatch[k] = Math.max(0, (targetKingdom[k] ?? 0) - (lostDef[k] ?? 0))
        }
        for (const k of DEFENSE_KEYS) {
          defPatch[k] = Math.max(0, (targetKingdom[k] ?? 0) - (lostDef[k] ?? 0) + (repaired[k] ?? 0))
        }

        await db.update(kingdoms).set(defPatch).where(eq(kingdoms.id, targetKingdom.id))
      }

      // Surviving attacker units to carry home
      const survivorPatch = {}
      for (const k of UNIT_KEYS) {
        survivorPatch[k] = survivingAtk[k] ?? 0
      }

      await db.update(armyMissions).set({
        ...survivorPatch,
        state: 'returning', returnTime,
        woodLoad: loot.wood, stoneLoad: loot.stone, grainLoad: loot.grain,
        result: JSON.stringify({
          type: 'attack', outcome, rounds,
          loot, debris,
          lostAtk, lostDef,
        }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))

    } else {
      // Defeat — all attacker units lost, return empty
      const zeroPatch = {}
      for (const k of UNIT_KEYS) zeroPatch[k] = 0

      // Repair defender defenses even on defeat
      if (targetKingdom) {
        const defLostDefenses = {}
        for (const k of DEFENSE_KEYS) defLostDefenses[k] = lostDef[k] ?? 0
        const repaired = repairDefenses(defLostDefenses)
        const defPatch = { updatedAt: new Date() }
        for (const k of UNIT_KEYS)   defPatch[k] = Math.max(0, (targetKingdom[k] ?? 0) - (lostDef[k] ?? 0))
        for (const k of DEFENSE_KEYS) defPatch[k] = Math.max(0, (targetKingdom[k] ?? 0) - (lostDef[k] ?? 0) + (repaired[k] ?? 0))
        await db.update(kingdoms).set(defPatch).where(eq(kingdoms.id, targetKingdom.id))
      }

      await db.update(armyMissions).set({
        ...zeroPatch, state: 'returning', returnTime,
        woodLoad: 0, stoneLoad: 0, grainLoad: 0,
        result: JSON.stringify({ type: 'attack', outcome: 'defeat', rounds, lostAtk, lostDef, debris }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))
    }
    return
  }

  // Unknown type — just turn around
  await db.update(armyMissions).set({
    state: 'returning', returnTime, updatedAt: new Date(),
  }).where(eq(armyMissions.id, mission.id))
}

async function processReturn(mission, kingdom, now) {
  const patch = { updatedAt: new Date() }

  for (const k of UNIT_KEYS) {
    const count = mission[k] ?? 0
    if (count > 0) patch[k] = (kingdom[k] ?? 0) + count
  }

  if (mission.woodLoad  > 0) patch.wood  = Math.min((kingdom.wood  ?? 0) + mission.woodLoad,  kingdom.woodCapacity)
  if (mission.stoneLoad > 0) patch.stone = Math.min((kingdom.stone ?? 0) + mission.stoneLoad, kingdom.stoneCapacity)
  if (mission.grainLoad > 0) patch.grain = Math.min((kingdom.grain ?? 0) + mission.grainLoad, kingdom.grainCapacity)

  await db.update(kingdoms).set(patch).where(eq(kingdoms.id, kingdom.id))
  Object.assign(kingdom, patch)

  await db.delete(armyMissions).where(eq(armyMissions.id, mission.id))
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const [kingdom] = await db.select().from(kingdoms)
    .where(eq(kingdoms.userId, userId)).limit(1)
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  await processMissions(userId, kingdom)

  const active = await db.select().from(armyMissions)
    .where(eq(armyMissions.userId, userId))

  const now = Math.floor(Date.now() / 1000)
  const missions = active
    .filter(m => m.state === 'active' || m.state === 'returning')
    .map(m => {
      const missionUnits = {}
      for (const k of UNIT_KEYS) if ((m[k] ?? 0) > 0) missionUnits[k] = m[k]

      const eta = m.state === 'returning'
        ? Math.max(0, (m.returnTime ?? 0) - now)
        : Math.max(0, m.arrivalTime - now)

      return {
        id: m.id,
        missionType: m.missionType,
        state: m.state,
        target: { realm: m.targetRealm, region: m.targetRegion, slot: m.targetSlot },
        origin: { realm: m.startRealm,  region: m.startRegion,  slot: m.startSlot  },
        arrivalTime: m.arrivalTime,
        returnTime:  m.returnTime,
        eta,
        units: missionUnits,
        resources: { wood: m.woodLoad ?? 0, stone: m.stoneLoad ?? 0, grain: m.grainLoad ?? 0 },
        result: m.result ? JSON.parse(m.result) : null,
      }
    })

  return res.json({ missions })
}
