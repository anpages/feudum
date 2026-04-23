import { db, battleLog } from '../_db.js'

export async function insertBattleLog({
  attackerKingdomId, attackerName,
  defenderKingdomId, defenderName,
  missionType, outcome,
  lootWood, lootStone, lootGrain,
  attackerLosses, defenderLosses, rounds,
  attackerCoord, defenderCoord,
}) {
  try {
    await db.insert(battleLog).values({
      attackerKingdomId: attackerKingdomId ?? null,
      attackerName,
      attackerCoord: attackerCoord ?? '',
      defenderKingdomId: defenderKingdomId ?? null,
      defenderName,
      defenderCoord: defenderCoord ?? '',
      missionType,
      outcome,
      lootWood:       lootWood       ?? 0,
      lootStone:      lootStone      ?? 0,
      lootGrain:      lootGrain      ?? 0,
      attackerLosses: attackerLosses ?? 0,
      defenderLosses: defenderLosses ?? 0,
      rounds:         rounds         ?? 0,
    })
  } catch (_) {
    // Non-critical — don't let logging failures break the game
  }
}

export function sumLosses(lostMap) {
  return Object.values(lostMap ?? {}).reduce((s, n) => s + (n ?? 0), 0)
}
