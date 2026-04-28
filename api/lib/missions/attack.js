import { eq, and } from 'drizzle-orm'
import { db, kingdoms, armyMissions, messages, debrisFields, users } from '../../_db.js'
import {
  buildBattleUnits, runBattle, calculateLoot,
  calculateDebris, repairDefenses, calcCargoCapacity,
} from '../battle.js'
import { UNIT_KEYS, DEFENSE_KEYS, extractUnits, extractMissionUnits } from './keys.js'
import { sendPush } from '../push.js'
import { insertBattleLog, sumLosses } from '../battle_log.js'
import { getResearchMap, enrichKingdom, batchUpsertUnits } from '../db-helpers.js'
import { getPoiBonusForKingdom } from '../poi-bonus.js'

async function upsertDebris(realm, region, slot, debris) {
  if (debris.wood <= 0 && debris.stone <= 0) return
  const [existing] = await db.select().from(debrisFields).where(and(
    eq(debrisFields.realm,  realm),
    eq(debrisFields.region, region),
    eq(debrisFields.slot,   slot),
  )).limit(1)
  if (existing) {
    await db.update(debrisFields).set({
      wood:  existing.wood  + debris.wood,
      stone: existing.stone + debris.stone,
      updatedAt: new Date(),
    }).where(eq(debrisFields.id, existing.id))
  } else {
    await db.insert(debrisFields).values({ realm, region, slot, wood: debris.wood, stone: debris.stone })
  }
}

export async function processAttack(mission, myKingdom, now, targetKingdom) {
  const travelSecs   = mission.arrivalTime - mission.departureTime
  const returnTime   = now + travelSecs
  const missionUnits = extractMissionUnits(mission, UNIT_KEYS)

  const [atkResMap, [atkUserRow]] = await Promise.all([
    getResearchMap(myKingdom.userId),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, myKingdom.userId)).limit(1),
  ])
  const atkClass      = atkUserRow?.characterClass ?? null
  const attackerUnits = buildBattleUnits(missionUnits, atkResMap, {}, atkClass)

  let defenderUnits = []
  let defRes        = { wood: 0, stone: 0, grain: 0 }
  let enrichedTarget = null

  let defForce = {}
  if (targetKingdom) {
    enrichedTarget = await enrichKingdom(targetKingdom, { withUnits: true })
    const defResMap = await getResearchMap(targetKingdom.userId)
    const [defUserRow] = await db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, targetKingdom.userId)).limit(1)
    // POI 'templo_perdido' del defensor: +5% atk/shield al defender
    const defPoiBonus = await getPoiBonusForKingdom(targetKingdom.id)
    defForce = { ...extractUnits(enrichedTarget, UNIT_KEYS), ...extractUnits(enrichedTarget, DEFENSE_KEYS) }
    defenderUnits = buildBattleUnits(defForce, defResMap, {}, defUserRow?.characterClass ?? null, defPoiBonus?.combatDef ?? 0)
    defRes = { wood: targetKingdom.wood, stone: targetKingdom.stone, grain: targetKingdom.grain }
  } else {
    const seed    = mission.targetRealm * 374761397 + mission.targetRegion * 1234567 + mission.targetSlot * 7654321
    const npcPts  = ((seed ^ (seed >>> 16)) >>> 0) % 20000
    defForce = { archer: 5 + Math.floor(npcPts / 2000), ballista: Math.floor(npcPts / 5000) }
    defenderUnits = buildBattleUnits(defForce, {})
    defRes        = { wood: 1000 + npcPts / 10, stone: 800 + npcPts / 12, grain: 600 + npcPts / 15 }
  }

  const { outcome, rounds, survivingAtk, lostAtk, lostDef } = runBattle(attackerUnits, defenderUnits)
  const debris   = calculateDebris(lostAtk, lostDef)
  const targetName = targetKingdom?.name ?? `NPC (R${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot})`

  if (outcome === 'victory' || outcome === 'draw') {
    const cargo = calcCargoCapacity(missionUnits, atkClass)
    const loot  = outcome === 'victory' ? calculateLoot(defRes, cargo) : { wood: 0, stone: 0, grain: 0 }

    if (enrichedTarget) {
      // Update defender units: subtract losses, add repaired defenses
      const repaired = repairDefenses(extractUnits(lostDef, DEFENSE_KEYS))
      const defUnitPatch = {}
      for (const k of UNIT_KEYS)    defUnitPatch[k] = Math.max(0, (enrichedTarget[k] ?? 0) - (lostDef[k] ?? 0))
      for (const k of DEFENSE_KEYS) defUnitPatch[k] = Math.max(0, (enrichedTarget[k] ?? 0) - (lostDef[k] ?? 0) + (repaired[k] ?? 0))
      await batchUpsertUnits(targetKingdom.id, defUnitPatch)

      // Deduct loot from defender resources
      if (outcome === 'victory') {
        await db.update(kingdoms).set({
          wood:  Math.max(0, targetKingdom.wood  - loot.wood),
          stone: Math.max(0, targetKingdom.stone - loot.stone),
          grain: Math.max(0, targetKingdom.grain - loot.grain),
          updatedAt: new Date(),
        }).where(eq(kingdoms.id, targetKingdom.id))
      }
    }

    const battleResult = { type: 'attack', outcome, rounds, loot, debris, lostAtk, lostDef }

    await upsertDebris(mission.targetRealm, mission.targetRegion, mission.targetSlot, debris)

    await db.update(armyMissions).set({
      units: survivingAtk,
      state: 'returning', returnTime,
      woodLoad: loot.wood, stoneLoad: loot.stone, grainLoad: loot.grain,
      result: JSON.stringify(battleResult), updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))

    insertBattleLog({
      attackerKingdomId: myKingdom.id,      attackerName: myKingdom.name, attackerIsNpc: false,
      attackerForce: missionUnits, attackerLost: lostAtk,
      defenderKingdomId: targetKingdom?.id, defenderName: targetName,    defenderIsNpc: targetKingdom?.isNpc ?? false,
      defenderForce: defForce,     defenderLost: lostDef,
      missionType: 'attack', outcome,
      lootWood: loot.wood, lootStone: loot.stone, lootGrain: loot.grain,
      attackerLosses: sumLosses(lostAtk), defenderLosses: sumLosses(lostDef), rounds,
      attackerCoord: `${mission.startRealm}:${mission.startRegion}:${mission.startSlot}`,
      defenderCoord: `${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot}`,
    }).catch(() => {})

    await db.insert(messages).values({
      userId: myKingdom.userId, type: 'battle',
      subject: `${outcome === 'victory' ? '⚔️ Victoria' : '🤝 Empate'} contra ${targetName}`,
      data: battleResult,
    })
    if (targetKingdom?.userId && !targetKingdom.isNpc) {
      const defOutcome = outcome === 'victory' ? 'defeat' : outcome
      await db.insert(messages).values({
        userId: targetKingdom.userId, type: 'battle',
        subject: '🛡️ Tu reino fue atacado',
        data: { ...battleResult, outcome: defOutcome },
      })
      sendPush(targetKingdom.userId, {
        title: defOutcome === 'defeat' ? '💀 Tu reino fue saqueado' : '🛡️ Ataque repelido',
        body: `${myKingdom.name} te atacó. ${defOutcome === 'defeat' ? 'Has perdido recursos.' : 'El enemigo fue rechazado.'}`,
        url: '/messages',
      }).catch(() => {})
    }
  } else {
    // Defeat
    if (enrichedTarget) {
      const repaired = repairDefenses(extractUnits(lostDef, DEFENSE_KEYS))
      const defUnitPatch = {}
      for (const k of UNIT_KEYS)    defUnitPatch[k] = Math.max(0, (enrichedTarget[k] ?? 0) - (lostDef[k] ?? 0))
      for (const k of DEFENSE_KEYS) defUnitPatch[k] = Math.max(0, (enrichedTarget[k] ?? 0) - (lostDef[k] ?? 0) + (repaired[k] ?? 0))
      await batchUpsertUnits(targetKingdom.id, defUnitPatch)
    }

    const battleResult = { type: 'attack', outcome: 'defeat', rounds, lostAtk, lostDef, debris }

    await upsertDebris(mission.targetRealm, mission.targetRegion, mission.targetSlot, debris)

    await db.update(armyMissions).set({
      units: {},
      state: 'returning', returnTime,
      woodLoad: 0, stoneLoad: 0, grainLoad: 0,
      result: JSON.stringify(battleResult), updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))

    insertBattleLog({
      attackerKingdomId: myKingdom.id,      attackerName: myKingdom.name, attackerIsNpc: false,
      attackerForce: missionUnits, attackerLost: lostAtk,
      defenderKingdomId: targetKingdom?.id, defenderName: targetName,    defenderIsNpc: targetKingdom?.isNpc ?? false,
      defenderForce: defForce,     defenderLost: lostDef,
      missionType: 'attack', outcome: 'defeat',
      lootWood: 0, lootStone: 0, lootGrain: 0,
      attackerLosses: sumLosses(lostAtk), defenderLosses: sumLosses(lostDef), rounds,
      attackerCoord: `${mission.startRealm}:${mission.startRegion}:${mission.startSlot}`,
      defenderCoord: `${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot}`,
    }).catch(() => {})

    await db.insert(messages).values({
      userId: myKingdom.userId, type: 'battle',
      subject: `💀 Derrota contra ${targetName}`,
      data: battleResult,
    })
    if (targetKingdom?.userId && !targetKingdom.isNpc) {
      await db.insert(messages).values({
        userId: targetKingdom.userId, type: 'battle',
        subject: '🛡️ Defensa exitosa — atacante derrotado',
        data: { ...battleResult, outcome: 'victory' },
      })
    }
  }
}
