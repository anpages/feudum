/**
 * Resolve arrived NPC attack missions targeting the given player kingdoms.
 * Called lazily from GET /api/armies and GET /api/messages.
 */
import { eq, and } from 'drizzle-orm'
import { db, kingdoms, armyMissions, research, messages, debrisFields } from '../_db.js'
import {
  buildBattleUnits, runBattle, calculateLoot,
  calculateDebris, repairDefenses, calcCargoCapacity,
} from './battle.js'
import { insertBattleLog, sumLosses } from './battle_log.js'

const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]
const DEFENSE_KEYS = [
  'archer','crossbowman','ballista','trebuchet',
  'mageTower','dragonCannon','palisade','castleWall','moat','catapult','beacon',
]

function extractUnits(row, keys) {
  const out = {}
  for (const k of keys) out[k] = row[k] ?? 0
  return out
}

export async function resolveIncomingNpcAttacks(playerKingdoms, now) {
  for (const defKingdom of playerKingdoms) {
    const arrivedAttacks = await db.select().from(armyMissions)
      .where(and(
        eq(armyMissions.missionType,  'attack'),
        eq(armyMissions.state,        'active'),
        eq(armyMissions.targetRealm,  defKingdom.realm),
        eq(armyMissions.targetRegion, defKingdom.region),
        eq(armyMissions.targetSlot,   defKingdom.slot),
      ))

    for (const m of arrivedAttacks) {
      if (m.arrivalTime > now) continue

      // Verify attacker is NPC kingdom
      const [npcKingdom] = await db.select().from(kingdoms)
        .where(and(
          eq(kingdoms.realm,   m.startRealm),
          eq(kingdoms.region,  m.startRegion),
          eq(kingdoms.slot,    m.startSlot),
          eq(kingdoms.isNpc,   true),
        )).limit(1)
      if (!npcKingdom) continue

      const missionUnits  = extractUnits(m, UNIT_KEYS)
      const attackerUnits = buildBattleUnits(missionUnits, {})

      const [defResearch] = await db.select().from(research)
        .where(eq(research.userId, defKingdom.userId)).limit(1)
      const defenderUnits = buildBattleUnits(
        { ...extractUnits(defKingdom, UNIT_KEYS), ...extractUnits(defKingdom, DEFENSE_KEYS) },
        defResearch ?? {}
      )

      const defRes = { wood: defKingdom.wood, stone: defKingdom.stone, grain: defKingdom.grain }
      const { outcome, rounds, survivingAtk, lostAtk, lostDef } =
        runBattle(attackerUnits, defenderUnits)

      const cargo  = calcCargoCapacity(missionUnits)
      const loot   = outcome === 'victory' ? calculateLoot(defRes, cargo) : { wood: 0, stone: 0, grain: 0 }
      const debris = calculateDebris(lostAtk, lostDef)
      const travelSecs = m.arrivalTime - m.departureTime
      const returnTime = now + travelSecs

      // Update defender kingdom
      const defPatch = { updatedAt: new Date() }
      if (outcome === 'victory') {
        defPatch.wood  = Math.max(0, defKingdom.wood  - loot.wood)
        defPatch.stone = Math.max(0, defKingdom.stone - loot.stone)
        defPatch.grain = Math.max(0, defKingdom.grain - loot.grain)
      }
      const repaired = repairDefenses(Object.fromEntries(DEFENSE_KEYS.map(k => [k, lostDef[k] ?? 0])))
      for (const k of UNIT_KEYS)    defPatch[k] = Math.max(0, (defKingdom[k] ?? 0) - (lostDef[k] ?? 0))
      for (const k of DEFENSE_KEYS) defPatch[k] = Math.max(0, (defKingdom[k] ?? 0) - (lostDef[k] ?? 0) + (repaired[k] ?? 0))
      await db.update(kingdoms).set(defPatch).where(eq(kingdoms.id, defKingdom.id))
      Object.assign(defKingdom, defPatch)

      // Debris
      if (debris.wood > 0 || debris.stone > 0) {
        const [existing] = await db.select().from(debrisFields)
          .where(and(
            eq(debrisFields.realm,  m.targetRealm),
            eq(debrisFields.region, m.targetRegion),
            eq(debrisFields.slot,   m.targetSlot),
          )).limit(1)
        if (existing) {
          await db.update(debrisFields).set({
            wood: existing.wood + debris.wood, stone: existing.stone + debris.stone, updatedAt: new Date(),
          }).where(eq(debrisFields.id, existing.id))
        } else {
          await db.insert(debrisFields).values({
            realm: m.targetRealm, region: m.targetRegion, slot: m.targetSlot,
            wood: debris.wood, stone: debris.stone,
          })
        }
      }

      // outcome is from attacker (NPC) perspective; flip for player (defender)
      const playerOutcome = outcome === 'victory' ? 'defeat' : outcome === 'defeat' ? 'victory' : 'draw'
      const battleResult = {
        type: 'attack',
        outcome: playerOutcome,
        rounds, loot, debris, lostAtk, lostDef,
        attackerName: npcKingdom.name,
        npcLevel: npcKingdom.npcLevel,
      }

      insertBattleLog({
        attackerKingdomId: npcKingdom.id, attackerName: npcKingdom.name, attackerIsNpc: true,
        defenderKingdomId: defKingdom.id, defenderName: defKingdom.name, defenderIsNpc: false,
        missionType: 'attack', outcome,
        lootWood: loot.wood, lootStone: loot.stone, lootGrain: loot.grain,
        attackerLosses: sumLosses(lostAtk), defenderLosses: sumLosses(lostDef), rounds,
        attackerCoord: `${m.startRealm}:${m.startRegion}:${m.startSlot}`,
        defenderCoord: `${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`,
      }).catch(() => {})

      await db.insert(messages).values({
        userId:  defKingdom.userId,
        type:    'battle',
        subject: outcome === 'victory'
          ? `💀 Tu reino fue saqueado por ${npcKingdom.name}`
          : `🛡️ Defensa exitosa contra ${npcKingdom.name}`,
        data: JSON.stringify(battleResult),
      })

      // NPC mission: return with loot or delete on defeat
      if (outcome === 'victory') {
        const survivorPatch = {}
        for (const k of UNIT_KEYS) survivorPatch[k] = survivingAtk[k] ?? 0
        await db.update(armyMissions).set({
          ...survivorPatch, state: 'returning', returnTime,
          woodLoad: loot.wood, stoneLoad: loot.stone, grainLoad: loot.grain,
          result: JSON.stringify(battleResult), updatedAt: new Date(),
        }).where(eq(armyMissions.id, m.id))
      } else {
        await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      }
    }
  }
}
