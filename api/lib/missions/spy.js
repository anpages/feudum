import { eq, and } from 'drizzle-orm'
import { db, kingdoms, armyMissions, research, messages } from '../../_db.js'
import { UNIT_KEYS, DEFENSE_KEYS } from './keys.js'

export async function processSpy(mission, myKingdom, now) {
  const missionUnits = {}
  for (const k of UNIT_KEYS) missionUnits[k] = mission[k] ?? 0

  const scouts      = missionUnits.scout ?? 0
  const travelSecs  = mission.arrivalTime - mission.departureTime
  const returnTime  = now + travelSecs

  const [target] = await db.select().from(kingdoms).where(and(
    eq(kingdoms.realm,  mission.targetRealm),
    eq(kingdoms.region, mission.targetRegion),
    eq(kingdoms.slot,   mission.targetSlot),
  )).limit(1)

  const [atkRes] = await db.select().from(research)
    .where(eq(research.userId, myKingdom.userId)).limit(1)
  const atkSpy = atkRes?.spycraft ?? 0

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
    const [defRes] = await db.select().from(research)
      .where(eq(research.userId, target.userId)).limit(1)
    const defSpy = defRes?.spycraft ?? 0

    const techDiff    = Math.max(0, defSpy - atkSpy)
    const extraNeeded = techDiff * techDiff
    const remaining   = Math.max(0, scouts - extraNeeded)

    const canSee = (threshold, levelAdv) =>
      remaining >= threshold || atkSpy - levelAdv >= defSpy

    const defenderShips = UNIT_KEYS.reduce((s, k) => s + (target[k] ?? 0), 0)
    const detectionChance = defenderShips > 0
      ? Math.min(100, Math.max(0, (defenderShips * (defSpy - atkSpy + 1)) / (scouts * 4) * 100))
      : 0
    const detected = Math.random() * 100 < detectionChance

    const pick = (keys) => {
      const obj = {}
      for (const k of keys) if ((target[k] ?? 0) > 0) obj[k] = target[k]
      return Object.keys(obj).length ? obj : null
    }

    const [tgtRes] = await db.select().from(research)
      .where(eq(research.userId, target.userId)).limit(1)

    report = {
      type: 'spy', isNpc: false, targetName: target.name,
      resources: { wood: target.wood, stone: target.stone, grain: target.grain },
      units:       canSee(2, 1) ? pick(UNIT_KEYS)    : null,
      defense:     canSee(3, 2) ? pick(DEFENSE_KEYS) : null,
      buildings:   canSee(5, 3) ? {
        sawmill: target.sawmill, quarry: target.quarry, grainFarm: target.grainFarm,
        windmill: target.windmill, workshop: target.workshop, barracks: target.barracks,
        academy: target.academy,
      } : null,
      researchData: canSee(7, 4) && tgtRes ? {
        alchemy: tgtRes.alchemy, pyromancy: tgtRes.pyromancy, runemastery: tgtRes.runemastery,
        mysticism: tgtRes.mysticism, dragonlore: tgtRes.dragonlore,
        swordsmanship: tgtRes.swordsmanship, armoury: tgtRes.armoury,
        fortification: tgtRes.fortification, horsemanship: tgtRes.horsemanship,
        cartography: tgtRes.cartography, logistics: tgtRes.logistics,
        spycraft: tgtRes.spycraft,
      } : null,
      detected, detectionChance: Math.round(detectionChance),
    }

    if (detected && target.userId && !target.isNpc) {
      await db.insert(messages).values({
        userId: target.userId, type: 'spy',
        subject: 'Espía detectado en tu reino',
        data: JSON.stringify({ type: 'spy_detected', spycraft: atkSpy, scouts }),
      })
    }
  }

  await db.insert(messages).values({
    userId: myKingdom.userId, type: 'spy',
    subject: `Informe de espionaje: ${report.targetName}`,
    data: JSON.stringify(report),
  })

  await db.update(armyMissions).set({
    state: 'returning', returnTime,
    result: JSON.stringify(report),
    updatedAt: new Date(),
  }).where(eq(armyMissions.id, mission.id))
}
