import { db, battleLog } from '../_db.js'

function nz(obj) {
  return Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => (v ?? 0) > 0))
}

export async function insertBattleLog({
  attackerKingdomId, attackerName, attackerIsNpc,
  attackerForce, attackerLost,
  defenderKingdomId, defenderName, defenderIsNpc,
  defenderForce, defenderLost,
  missionType, outcome,
  lootWood, lootStone, lootGrain,
  attackerLosses, defenderLosses, rounds,
  attackerCoord, defenderCoord,
}) {
  try {
    await db.insert(battleLog).values({
      attackerKingdomId: attackerKingdomId ?? null,
      attackerName,
      attackerCoord:  attackerCoord  ?? '',
      attackerIsNpc:  attackerIsNpc  ?? false,
      attackerForce:  nz(attackerForce),
      attackerLost:   nz(attackerLost),
      defenderKingdomId: defenderKingdomId ?? null,
      defenderName,
      defenderCoord:  defenderCoord  ?? '',
      defenderIsNpc:  defenderIsNpc  ?? false,
      defenderForce:  nz(defenderForce),
      defenderLost:   nz(defenderLost),
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
