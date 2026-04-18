import { eq, and, lte, or } from 'drizzle-orm'
import { db, kingdoms, users, armyMissions } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { calcTotalAttack } from '../lib/speed.js'

const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]

const DEFENSE_KEYS = [
  'archer','crossbowman','ballista','trebuchet',
  'mageTower','dragonCannon','palisade','castleWall',
]

const DEFENSE_ATTACK = {
  archer: 80, crossbowman: 100, ballista: 250, trebuchet: 1100,
  mageTower: 150, dragonCannon: 3000, palisade: 1, castleWall: 1,
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
  const mType      = mission.missionType
  const travelSecs = mission.arrivalTime - mission.departureTime
  const returnTime = now + travelSecs

  const missionUnits = {}
  for (const k of UNIT_KEYS) missionUnits[k] = mission[k] ?? 0

  if (mType === 'spy') {
    // Just turns around
    await db.update(armyMissions).set({
      state: 'returning', returnTime,
      result: JSON.stringify({ type: 'spy', message: 'Misión de espionaje completada.' }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
    return
  }

  // Find target kingdom (real player kingdom, not NPC)
  const [targetKingdom] = await db
    .select().from(kingdoms)
    .where(and(
      eq(kingdoms.realm,  mission.targetRealm),
      eq(kingdoms.region, mission.targetRegion),
      eq(kingdoms.slot,   mission.targetSlot),
    )).limit(1)

  if (mType === 'transport') {
    if (targetKingdom) {
      // Deposit resources
      const newWood  = Math.min(targetKingdom.wood  + mission.woodLoad,  targetKingdom.woodCapacity)
      const newStone = Math.min(targetKingdom.stone + mission.stoneLoad, targetKingdom.stoneCapacity)
      const newGrain = Math.min(targetKingdom.grain + mission.grainLoad, targetKingdom.grainCapacity)
      await db.update(kingdoms).set({
        wood: newWood, stone: newStone, grain: newGrain, updatedAt: new Date(),
      }).where(eq(kingdoms.id, targetKingdom.id))

      await db.update(armyMissions).set({
        state: 'returning', returnTime,
        woodLoad: 0, stoneLoad: 0, grainLoad: 0,
        result: JSON.stringify({ type: 'transport', delivered: true }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))
    } else {
      // No kingdom at target, turn around with resources intact
      await db.update(armyMissions).set({
        state: 'returning', returnTime,
        result: JSON.stringify({ type: 'transport', delivered: false, reason: 'No hay reino en el destino' }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))
    }
    return
  }

  if (mType === 'attack') {
    // Simple battle: compare total attack values
    const attackerPower = calcTotalAttack(missionUnits)

    let defenderPower = 0
    let lootWood = 0, lootStone = 0, lootGrain = 0
    let resultMsg

    if (!targetKingdom) {
      // NPC target — fixed defence based on seeded rand (simplified)
      defenderPower = 5000
    } else {
      // Real kingdom defenses + units
      for (const dk of DEFENSE_KEYS) {
        defenderPower += (DEFENSE_ATTACK[dk] ?? 0) * (targetKingdom[dk] ?? 0)
      }
      for (const uk of UNIT_KEYS) {
        defenderPower += (missionUnits[uk] ? 0 : 0) // defender's units add nothing in simplified model
      }
    }

    if (attackerPower > defenderPower) {
      // Victory — loot up to cargo capacity
      const capacity = calcLootCapacity(missionUnits)
      const available = targetKingdom
        ? { wood: targetKingdom.wood, stone: targetKingdom.stone, grain: targetKingdom.grain }
        : { wood: 2500, stone: 2500, grain: 2500 }  // NPC always has some

      const totalAvail = available.wood + available.stone + available.grain
      if (totalAvail > 0) {
        const ratio = Math.min(1, (capacity * 0.5) / totalAvail)
        lootWood  = Math.min(available.wood  * ratio, available.wood  * 0.5)
        lootStone = Math.min(available.stone * ratio, available.stone * 0.5)
        lootGrain = Math.min(available.grain * ratio, available.grain * 0.5)
      }

      if (targetKingdom) {
        await db.update(kingdoms).set({
          wood:  Math.max(0, targetKingdom.wood  - lootWood),
          stone: Math.max(0, targetKingdom.stone - lootStone),
          grain: Math.max(0, targetKingdom.grain - lootGrain),
          updatedAt: new Date(),
        }).where(eq(kingdoms.id, targetKingdom.id))
      }

      resultMsg = { type: 'attack', outcome: 'victory', lootWood, lootStone, lootGrain }
    } else {
      // Defeat — units are lost, return empty
      const zeroPatch = {}
      for (const k of UNIT_KEYS) zeroPatch[k] = 0
      await db.update(armyMissions).set({
        ...zeroPatch, state: 'returning', returnTime,
        woodLoad: 0, stoneLoad: 0, grainLoad: 0,
        result: JSON.stringify({ type: 'attack', outcome: 'defeat' }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))
      return
    }

    await db.update(armyMissions).set({
      state: 'returning', returnTime,
      woodLoad: lootWood, stoneLoad: lootStone, grainLoad: lootGrain,
      result: JSON.stringify(resultMsg),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
    return
  }

  // Unknown type — just return
  await db.update(armyMissions).set({
    state: 'returning', returnTime, updatedAt: new Date(),
  }).where(eq(armyMissions.id, mission.id))
}

async function processReturn(mission, kingdom, now) {
  // Restore units to origin kingdom + deposit loot
  const patch = { updatedAt: new Date() }

  const missionUnits = {}
  for (const k of UNIT_KEYS) {
    const count = mission[k] ?? 0
    if (count > 0) {
      patch[k] = (kingdom[k] ?? 0) + count
      missionUnits[k] = count
    }
  }

  // Add loot
  if (mission.woodLoad  > 0) patch.wood  = Math.min((kingdom.wood  ?? 0) + mission.woodLoad,  kingdom.woodCapacity)
  if (mission.stoneLoad > 0) patch.stone = Math.min((kingdom.stone ?? 0) + mission.stoneLoad, kingdom.stoneCapacity)
  if (mission.grainLoad > 0) patch.grain = Math.min((kingdom.grain ?? 0) + mission.grainLoad, kingdom.grainCapacity)

  await db.update(kingdoms).set(patch).where(eq(kingdoms.id, kingdom.id))

  // Update local kingdom object so subsequent returns in same request are cumulative
  Object.assign(kingdom, patch)

  await db.delete(armyMissions).where(eq(armyMissions.id, mission.id))
}

function calcLootCapacity(units) {
  const CAP = { merchant: 5000, caravan: 25000, colonist: 7500, scavenger: 20000 }
  return Object.entries(units)
    .filter(([, n]) => n > 0)
    .reduce((s, [id, n]) => s + (CAP[id] ?? 0) * n, 0)
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const [kingdom] = await db.select().from(kingdoms)
    .where(eq(kingdoms.userId, userId)).limit(1)
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

  // Process arrived/returning missions
  await processMissions(userId, kingdom)

  // Reload missions after processing
  const active = await db.select().from(armyMissions)
    .where(eq(armyMissions.userId, userId))

  const now = Math.floor(Date.now() / 1000)
  const missions = active
    .filter(m => m.state === 'active' || m.state === 'returning')
    .map(m => {
      const missionUnits = {}
      for (const k of UNIT_KEYS) if (m[k] > 0) missionUnits[k] = m[k]

      const eta = m.state === 'returning'
        ? Math.max(0, (m.returnTime ?? 0) - now)
        : Math.max(0, m.arrivalTime - now)

      return {
        id: m.id,
        missionType: m.missionType,
        state: m.state,
        target: { realm: m.targetRealm, region: m.targetRegion, slot: m.targetSlot },
        origin: { realm: m.startRealm,  region: m.startRegion,  slot: m.startSlot  },
        arrivalTime:  m.arrivalTime,
        returnTime:   m.returnTime,
        eta,
        units: missionUnits,
        resources: { wood: m.woodLoad, stone: m.stoneLoad, grain: m.grainLoad },
        result: m.result ? JSON.parse(m.result) : null,
      }
    })

  return res.json({ missions })
}
