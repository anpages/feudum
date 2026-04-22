import { eq, and } from 'drizzle-orm'
import { db, kingdoms, armyMissions, research, messages, debrisFields } from '../../_db.js'
import {
  buildBattleUnits, runBattle, calculateLoot,
  calculateDebris, repairDefenses, calcCargoCapacity,
} from '../battle.js'
import { UNIT_KEYS, DEFENSE_KEYS, extractUnits } from './keys.js'
import { setSetting, getStringSetting } from '../settings.js'
import { sendPush } from '../push.js'
import { insertBattleLog, sumLosses } from '../battle_log.js'

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

function applyDefenderPatch(targetKingdom, lostDef, repaired) {
  const patch = { updatedAt: new Date() }
  for (const k of UNIT_KEYS)    patch[k] = Math.max(0, (targetKingdom[k] ?? 0) - (lostDef[k] ?? 0))
  for (const k of DEFENSE_KEYS) patch[k] = Math.max(0, (targetKingdom[k] ?? 0) - (lostDef[k] ?? 0) + (repaired[k] ?? 0))
  return patch
}

export async function processAttack(mission, myKingdom, now, targetKingdom) {
  const travelSecs   = mission.arrivalTime - mission.departureTime
  const returnTime   = now + travelSecs
  const missionUnits = extractUnits(mission, UNIT_KEYS)

  const [atkResearch] = await db.select().from(research)
    .where(eq(research.userId, myKingdom.userId)).limit(1)

  const attackerUnits = buildBattleUnits(missionUnits, atkResearch ?? {})

  let defenderUnits = []
  let defRes        = { wood: 0, stone: 0, grain: 0 }

  if (targetKingdom) {
    const [defResearch] = await db.select().from(research)
      .where(eq(research.userId, targetKingdom.userId)).limit(1)
    defenderUnits = buildBattleUnits(
      { ...extractUnits(targetKingdom, UNIT_KEYS), ...extractUnits(targetKingdom, DEFENSE_KEYS) },
      defResearch ?? {}
    )
    defRes = { wood: targetKingdom.wood, stone: targetKingdom.stone, grain: targetKingdom.grain }
  } else {
    const seed    = mission.targetRealm * 374761397 + mission.targetRegion * 1234567 + mission.targetSlot * 7654321
    const npcPts  = ((seed ^ (seed >>> 16)) >>> 0) % 20000
    defenderUnits = buildBattleUnits({ archer: 5 + Math.floor(npcPts / 2000), ballista: Math.floor(npcPts / 5000) }, {})
    defRes        = { wood: 1000 + npcPts / 10, stone: 800 + npcPts / 12, grain: 600 + npcPts / 15 }
  }

  const { outcome, rounds, survivingAtk, lostAtk, lostDef } = runBattle(attackerUnits, defenderUnits)
  const debris   = calculateDebris(lostAtk, lostDef)
  const targetName = targetKingdom?.name ?? `NPC (R${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot})`

  if (outcome === 'victory' || outcome === 'draw') {
    const cargo = calcCargoCapacity(missionUnits)
    const loot  = outcome === 'victory' ? calculateLoot(defRes, cargo) : { wood: 0, stone: 0, grain: 0 }

    if (targetKingdom) {
      const repaired  = repairDefenses(extractUnits(lostDef, DEFENSE_KEYS))
      await db.update(kingdoms).set(applyDefenderPatch(targetKingdom, lostDef, repaired))
        .where(eq(kingdoms.id, targetKingdom.id))
    }

    const survivorPatch = {}
    for (const k of UNIT_KEYS) survivorPatch[k] = survivingAtk[k] ?? 0

    const battleResult = { type: 'attack', outcome, rounds, loot, debris, lostAtk, lostDef }

    await upsertDebris(mission.targetRealm, mission.targetRegion, mission.targetSlot, debris)

    await db.update(armyMissions).set({
      ...survivorPatch, state: 'returning', returnTime,
      woodLoad: loot.wood, stoneLoad: loot.stone, grainLoad: loot.grain,
      result: JSON.stringify(battleResult), updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))

    // ── Season victory: player defeated the boss ───────────────────────────
    if (outcome === 'victory' && targetKingdom?.isBoss) {
      const seasonState = await getStringSetting('season_state')
      if (seasonState === 'active') {
        await Promise.all([
          setSetting('season_state',              'ended'),
          setSetting('season_end',                Math.floor(Date.now() / 1000)),
          setSetting('season_winner_user_id',     String(myKingdom.userId)),
          setSetting('season_winner_condition',   'boss_defeated'),
        ])
        await db.insert(messages).values({
          userId: myKingdom.userId, type: 'season',
          subject: '🏆 ¡Victoria de Temporada! — El Jefe Final ha caído',
          data: JSON.stringify({ seasonVictory: true, condition: 'boss_defeated', bossName: targetName }),
        })
        sendPush(myKingdom.userId, {
          title: '🏆 ¡Campeón de Temporada!',
          body: `Has derrotado a ${targetName}. ¡La temporada ha terminado!`,
          url: '/messages',
        }).catch(() => {})
      }
    }

    insertBattleLog({
      attackerKingdomId: myKingdom.id,      attackerName: myKingdom.name,    attackerIsNpc: false,
      defenderKingdomId: targetKingdom?.id, defenderName: targetName,        defenderIsNpc: targetKingdom?.isNpc ?? false,
      missionType: 'attack', outcome,
      lootWood: loot.wood, lootStone: loot.stone, lootGrain: loot.grain,
      attackerLosses: sumLosses(lostAtk), defenderLosses: sumLosses(lostDef), rounds,
      attackerCoord: `${mission.startRealm}:${mission.startRegion}:${mission.startSlot}`,
      defenderCoord: `${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot}`,
    }).catch(() => {})

    await db.insert(messages).values({
      userId: myKingdom.userId, type: 'battle',
      subject: `${outcome === 'victory' ? '⚔️ Victoria' : '🤝 Empate'} contra ${targetName}`,
      data: JSON.stringify(battleResult),
    })
    if (targetKingdom?.userId && !targetKingdom.isNpc) {
      const defOutcome = outcome === 'victory' ? 'defeat' : outcome
      await db.insert(messages).values({
        userId: targetKingdom.userId, type: 'battle',
        subject: '🛡️ Tu reino fue atacado',
        data: JSON.stringify({ ...battleResult, outcome: defOutcome }),
      })
      sendPush(targetKingdom.userId, {
        title: defOutcome === 'defeat' ? '💀 Tu reino fue saqueado' : '🛡️ Ataque repelido',
        body: `${myKingdom.name} te atacó. ${defOutcome === 'defeat' ? 'Has perdido recursos.' : 'El enemigo fue rechazado.'}`,
        url: '/messages',
      }).catch(() => {})
    }
  } else {
    // Defeat
    if (targetKingdom) {
      const repaired = repairDefenses(extractUnits(lostDef, DEFENSE_KEYS))
      await db.update(kingdoms).set(applyDefenderPatch(targetKingdom, lostDef, repaired))
        .where(eq(kingdoms.id, targetKingdom.id))
    }

    const zeroPatch = {}
    for (const k of UNIT_KEYS) zeroPatch[k] = 0

    const battleResult = { type: 'attack', outcome: 'defeat', rounds, lostAtk, lostDef, debris }

    await upsertDebris(mission.targetRealm, mission.targetRegion, mission.targetSlot, debris)

    await db.update(armyMissions).set({
      ...zeroPatch, state: 'returning', returnTime,
      woodLoad: 0, stoneLoad: 0, grainLoad: 0,
      result: JSON.stringify(battleResult), updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))

    insertBattleLog({
      attackerKingdomId: myKingdom.id,      attackerName: myKingdom.name, attackerIsNpc: false,
      defenderKingdomId: targetKingdom?.id, defenderName: targetName,     defenderIsNpc: targetKingdom?.isNpc ?? false,
      missionType: 'attack', outcome: 'defeat',
      lootWood: 0, lootStone: 0, lootGrain: 0,
      attackerLosses: sumLosses(lostAtk), defenderLosses: sumLosses(lostDef), rounds,
      attackerCoord: `${mission.startRealm}:${mission.startRegion}:${mission.startSlot}`,
      defenderCoord: `${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot}`,
    }).catch(() => {})

    await db.insert(messages).values({
      userId: myKingdom.userId, type: 'battle',
      subject: `💀 Derrota contra ${targetName}`,
      data: JSON.stringify(battleResult),
    })
    if (targetKingdom?.userId && !targetKingdom.isNpc) {
      await db.insert(messages).values({
        userId: targetKingdom.userId, type: 'battle',
        subject: '🛡️ Defensa exitosa — atacante derrotado',
        data: JSON.stringify({ ...battleResult, outcome: 'victory' }),
      })
    }
  }
}
