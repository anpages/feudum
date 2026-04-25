import { eq, and } from 'drizzle-orm'
import { db, kingdoms, armyMissions, messages, users } from '../../_db.js'
import { UNIT_KEYS, DEFENSE_KEYS } from './keys.js'
import { getResearchMap, enrichKingdom, getUnitMap, upsertUnit } from '../db-helpers.js'
import { buildBattleUnits, runBattle } from '../battle.js'

export async function processSpy(mission, myKingdom, now) {
  const missionUnits = mission.units ?? {}
  const scouts      = missionUnits.scout ?? 0
  const travelSecs  = mission.arrivalTime - mission.departureTime
  const returnTime  = now + travelSecs

  const [target] = await db.select().from(kingdoms).where(and(
    eq(kingdoms.realm,  mission.targetRealm),
    eq(kingdoms.region, mission.targetRegion),
    eq(kingdoms.slot,   mission.targetSlot),
  )).limit(1)

  const atkResMap = await getResearchMap(myKingdom.userId)
  const atkSpy = atkResMap.spycraft ?? 0

  let report
  if (!target) {
    const seed   = mission.targetRealm * 374761397 + mission.targetRegion * 1234567 + mission.targetSlot * 7654321
    const npcPts = ((seed ^ (seed >>> 16)) >>> 0) % 20000
    report = {
      type: 'spy', isNpc: true, targetName: 'Reino NPC',
      resources: { wood: Math.floor(1000 + npcPts / 10), stone: Math.floor(800 + npcPts / 12), grain: Math.floor(600 + npcPts / 15) },
      units: scouts >= 2 ? { archer: 5 + Math.floor(npcPts / 2000), ballista: Math.floor(npcPts / 5000) } : null,
      defense: scouts >= 3 ? { archer: 5 + Math.floor(npcPts / 2000), ballista: Math.floor(npcPts / 5000) } : null,
      buildings: null, researchData: null, detected: false,
    }
  } else {
    const [enrichedTarget, defResMap] = await Promise.all([
      enrichKingdom(target, { withUnits: true }),
      getResearchMap(target.userId),
    ])
    const defSpy = defResMap.spycraft ?? 0

    const techDiff    = Math.max(0, defSpy - atkSpy)
    const extraNeeded = techDiff * techDiff
    const remaining   = Math.max(0, scouts - extraNeeded)

    const canSee = (threshold, levelAdv) =>
      remaining >= threshold || atkSpy - levelAdv >= defSpy

    const defenderShips = UNIT_KEYS.reduce((s, k) => s + (enrichedTarget[k] ?? 0), 0)
    const detectionChance = defenderShips > 0
      ? Math.min(100, Math.max(0, (defenderShips * (defSpy - atkSpy + 1)) / (scouts * 4) * 100))
      : 0
    const detected = Math.random() * 100 < detectionChance

    const pick = (keys) => {
      const obj = {}
      for (const k of keys) if ((enrichedTarget[k] ?? 0) > 0) obj[k] = enrichedTarget[k]
      return Object.keys(obj).length ? obj : null
    }

    report = {
      type: 'spy', isNpc: target.isNpc ?? false, targetName: target.name,
      resources: { wood: target.wood, stone: target.stone, grain: target.grain },
      units:       canSee(2, 1) ? pick(UNIT_KEYS)    : null,
      defense:     canSee(3, 2) ? pick(DEFENSE_KEYS) : null,
      buildings:   canSee(5, 3) ? {
        sawmill:   enrichedTarget.sawmill   ?? 0,
        quarry:    enrichedTarget.quarry    ?? 0,
        grainFarm: enrichedTarget.grainFarm ?? 0,
        windmill:  enrichedTarget.windmill  ?? 0,
        workshop:  enrichedTarget.workshop  ?? 0,
        barracks:  enrichedTarget.barracks  ?? 0,
        academy:   enrichedTarget.academy   ?? 0,
      } : null,
      researchData: canSee(7, 4) ? {
        alchemy:       defResMap.alchemy       ?? 0,
        pyromancy:     defResMap.pyromancy     ?? 0,
        runemastery:   defResMap.runemastery   ?? 0,
        mysticism:     defResMap.mysticism     ?? 0,
        dragonlore:    defResMap.dragonlore    ?? 0,
        swordsmanship: defResMap.swordsmanship ?? 0,
        armoury:       defResMap.armoury       ?? 0,
        fortification: defResMap.fortification ?? 0,
        horsemanship:  defResMap.horsemanship  ?? 0,
        cartography:   defResMap.cartography   ?? 0,
        logistics:     defResMap.logistics     ?? 0,
        spycraft:      defResMap.spycraft      ?? 0,
      } : null,
      detected, detectionChance: Math.round(detectionChance),
    }

    if (detected && defenderShips > 0) {
      // ── Counter-espionage battle (OGame mechanic) ─────────────────────────────
      // Defender uses mobile units only (no static defenses), attacker = scouts.
      const defUnitMap = await getUnitMap(target.id)
      const defMobileMap = {}
      for (const k of UNIT_KEYS) {
        if ((defUnitMap[k] ?? 0) > 0) defMobileMap[k] = defUnitMap[k]
      }

      let defCharClass = null
      if (target.userId && !(target.isNpc ?? false)) {
        const [defUserRow] = await db.select({ characterClass: users.characterClass })
          .from(users).where(eq(users.id, target.userId)).limit(1)
        defCharClass = defUserRow?.characterClass ?? null
      }

      const atkUnits = buildBattleUnits({ scout: scouts }, atkResMap)
      const defUnits = buildBattleUnits(defMobileMap, defResMap, {}, defCharClass)

      const result = runBattle(atkUnits, defUnits)

      const survivingScouts = result.survivingAtk.scout ?? 0

      // Deduct defender's unit losses
      for (const [type, lost] of Object.entries(result.lostDef)) {
        if (lost > 0) {
          const current = defUnitMap[type] ?? 0
          await upsertUnit(target.id, type, Math.max(0, current - lost))
        }
      }

      report.counterEspionage = {
        outcome: result.outcome,
        rounds: result.rounds,
        scoutsSent: scouts,
        scoutsSurvived: survivingScouts,
        defenderLosses: result.lostDef,
      }

      // Notify defender (real players only — NPCs don't read messages)
      if (target.userId && !(target.isNpc ?? false)) {
        await db.insert(messages).values({
          userId: target.userId, type: 'spy',
          subject: 'Espías detectados y combatidos',
          data: {
            type: 'spy_detected',
            spycraft: atkSpy,
            scouts,
            counterEspionage: report.counterEspionage,
          },
        })
      }

      if (survivingScouts === 0) {
        // All scouts destroyed — no return mission, send loss report to attacker
        report.scoutsLost = true
        await db.insert(messages).values({
          userId: myKingdom.userId, type: 'spy',
          subject: `Informe de espionaje: ${report.targetName}`,
          data: report,
        })
        await db.update(armyMissions)
          .set({ state: 'completed', result: JSON.stringify(report), updatedAt: new Date() })
          .where(eq(armyMissions.id, mission.id))
        return
      }

      // Surviving scouts return (with reduced count)
      missionUnits.scout = survivingScouts
      await db.update(armyMissions)
        .set({ units: missionUnits, updatedAt: new Date() })
        .where(eq(armyMissions.id, mission.id))
    } else if (detected && target.userId && !(target.isNpc ?? false)) {
      // Detected but no defender units — just notify
      await db.insert(messages).values({
        userId: target.userId, type: 'spy',
        subject: 'Espía detectado en tu reino',
        data: { type: 'spy_detected', spycraft: atkSpy, scouts },
      })
    }
  }

  await db.insert(messages).values({
    userId: myKingdom.userId, type: 'spy',
    subject: `Informe de espionaje: ${report.targetName}`,
    data: report,
  })

  await db.update(armyMissions).set({
    state: 'returning', returnTime,
    result: JSON.stringify(report),
    updatedAt: new Date(),
  }).where(eq(armyMissions.id, mission.id))
}
