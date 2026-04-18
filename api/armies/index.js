import { eq, and } from 'drizzle-orm'
import { db, kingdoms, armyMissions, research, messages, debrisFields, users, etherTransactions } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import {
  buildBattleUnits, runBattle, calculateLoot,
  calculateDebris, repairDefenses, calcCargoCapacity, UNIT_STATS,
} from '../lib/battle.js'
import { resolveIncomingNpcAttacks } from '../lib/npc-resolve.js'
import { resolveExpedition } from '../lib/expedition.js'

const UNIT_KEYS = [
  'squire','knight','paladin','warlord','grandKnight',
  'siegeMaster','warMachine','dragonKnight',
  'merchant','caravan','colonist','scavenger','scout',
]
const DEFENSE_KEYS = [
  'archer','crossbowman','ballista','trebuchet',
  'mageTower','dragonCannon','palisade','castleWall','moat','catapult','beacon',
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
    const scouts = missionUnits.scout ?? 0

    // Resolve target
    const [target] = await db
      .select().from(kingdoms)
      .where(and(
        eq(kingdoms.realm,  mission.targetRealm),
        eq(kingdoms.region, mission.targetRegion),
        eq(kingdoms.slot,   mission.targetSlot),
      )).limit(1)

    // Attacker spycraft level
    const [atkRes] = await db.select().from(research)
      .where(eq(research.userId, myKingdom.userId)).limit(1)
    const atkSpy = atkRes?.spycraft ?? 0

    let report
    if (!target) {
      // NPC target
      const seed   = mission.targetRealm * 374761397 + mission.targetRegion * 1234567 + mission.targetSlot * 7654321
      const npcPts = ((seed ^ (seed >>> 16)) >>> 0) % 20000
      report = {
        type: 'spy',
        isNpc: true,
        targetName: 'Reino NPC',
        resources: { wood: Math.floor(1000 + npcPts / 10), stone: Math.floor(800 + npcPts / 12), grain: Math.floor(600 + npcPts / 15) },
        units:    scouts >= 2 ? { archer: 5 + Math.floor(npcPts / 2000), ballista: Math.floor(npcPts / 5000) } : null,
        defense:  scouts >= 3 ? { archer: 5 + Math.floor(npcPts / 2000), ballista: Math.floor(npcPts / 5000) } : null,
        buildings: null,
        researchData: null,
        detected: false,
      }
    } else {
      const [defRes] = await db.select().from(research)
        .where(eq(research.userId, target.userId)).limit(1)
      const defSpy = defRes?.spycraft ?? 0

      // OGame formula: extra scouts needed = max(0, defSpy - atkSpy)^2
      const techDiff = Math.max(0, defSpy - atkSpy)
      const extraNeeded = techDiff * techDiff
      const remaining = Math.max(0, scouts - extraNeeded)

      const canSee = (threshold, levelAdv) =>
        remaining >= threshold || atkSpy - levelAdv >= defSpy

      // Counter-espionage detection chance
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

      report = {
        type: 'spy',
        isNpc: false,
        targetName: target.name,
        resources: { wood: target.wood, stone: target.stone, grain: target.grain },
        units:       canSee(2, 1) ? pick(UNIT_KEYS)    : null,
        defense:     canSee(3, 2) ? pick(DEFENSE_KEYS) : null,
        buildings:   canSee(5, 3) ? {
          sawmill: target.sawmill, quarry: target.quarry, grainFarm: target.grainFarm,
          windmill: target.windmill, workshop: target.workshop, barracks: target.barracks,
          academy: target.academy,
        } : null,
        researchData: canSee(7, 4) ? null : null, // research visible only at high levels
        detected,
        detectionChance: Math.round(detectionChance),
      }

      // Notify defender if detected (skip NPC defenders)
      if (detected && target.userId && !target.isNpc) {
        await db.insert(messages).values({
          userId:  target.userId,
          type:    'spy',
          subject: `Espía detectado en tu reino`,
          data:    JSON.stringify({ type: 'spy_detected', spycraft: atkSpy, scouts }),
        })
      }
    }

    // Save spy report as message for attacker
    await db.insert(messages).values({
      userId:  myKingdom.userId,
      type:    'spy',
      subject: `Informe de espionaje: ${report.targetName}`,
      data:    JSON.stringify(report),
    })

    await db.update(armyMissions).set({
      state: 'returning', returnTime,
      result: JSON.stringify(report),
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

      const battleResult = { type: 'attack', outcome, rounds, loot, debris, lostAtk, lostDef }

      // Persist debris field if there's anything
      if (debris.wood > 0 || debris.stone > 0) {
        const [existing] = await db.select().from(debrisFields)
          .where(and(
            eq(debrisFields.realm,  mission.targetRealm),
            eq(debrisFields.region, mission.targetRegion),
            eq(debrisFields.slot,   mission.targetSlot),
          )).limit(1)
        if (existing) {
          await db.update(debrisFields).set({
            wood:  existing.wood  + debris.wood,
            stone: existing.stone + debris.stone,
            updatedAt: new Date(),
          }).where(eq(debrisFields.id, existing.id))
        } else {
          await db.insert(debrisFields).values({
            realm:  mission.targetRealm,
            region: mission.targetRegion,
            slot:   mission.targetSlot,
            wood:   debris.wood,
            stone:  debris.stone,
          })
        }
      }

      await db.update(armyMissions).set({
        ...survivorPatch,
        state: 'returning', returnTime,
        woodLoad: loot.wood, stoneLoad: loot.stone, grainLoad: loot.grain,
        result: JSON.stringify(battleResult),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))

      // Battle report messages
      const targetName = targetKingdom?.name ?? `NPC (R${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot})`
      await db.insert(messages).values({
        userId: myKingdom.userId,
        type: 'battle',
        subject: `${outcome === 'victory' ? '⚔️ Victoria' : '🤝 Empate'} contra ${targetName}`,
        data: JSON.stringify(battleResult),
      })
      if (targetKingdom?.userId && !targetKingdom.isNpc) {
        await db.insert(messages).values({
          userId: targetKingdom.userId,
          type: 'battle',
          subject: `🛡️ Tu reino fue atacado`,
          data: JSON.stringify({ ...battleResult, outcome: outcome === 'victory' ? 'defeat' : outcome }),
        })
      }

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

      const battleResult = { type: 'attack', outcome: 'defeat', rounds, lostAtk, lostDef, debris }

      if (debris.wood > 0 || debris.stone > 0) {
        const [existing] = await db.select().from(debrisFields)
          .where(and(
            eq(debrisFields.realm,  mission.targetRealm),
            eq(debrisFields.region, mission.targetRegion),
            eq(debrisFields.slot,   mission.targetSlot),
          )).limit(1)
        if (existing) {
          await db.update(debrisFields).set({
            wood:  existing.wood  + debris.wood,
            stone: existing.stone + debris.stone,
            updatedAt: new Date(),
          }).where(eq(debrisFields.id, existing.id))
        } else {
          await db.insert(debrisFields).values({
            realm:  mission.targetRealm,
            region: mission.targetRegion,
            slot:   mission.targetSlot,
            wood:   debris.wood,
            stone:  debris.stone,
          })
        }
      }

      await db.update(armyMissions).set({
        ...zeroPatch, state: 'returning', returnTime,
        woodLoad: 0, stoneLoad: 0, grainLoad: 0,
        result: JSON.stringify(battleResult),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))

      const targetName = targetKingdom?.name ?? `NPC (R${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot})`
      await db.insert(messages).values({
        userId: myKingdom.userId,
        type: 'battle',
        subject: `💀 Derrota contra ${targetName}`,
        data: JSON.stringify(battleResult),
      })
      if (targetKingdom?.userId && !targetKingdom.isNpc) {
        await db.insert(messages).values({
          userId: targetKingdom.userId,
          type: 'battle',
          subject: `🛡️ Defensa exitosa — atacante derrotado`,
          data: JSON.stringify({ ...battleResult, outcome: 'victory' }),
        })
      }
    }
    return
  }

  // ── Colonize ──────────────────────────────────────────────────────────────────
  if (mType === 'colonize') {
    if (!targetKingdom) {
      const kingdomName = `Colonia ${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot}`
      await db.insert(kingdoms).values({
        userId:   myKingdom.userId,
        name:     kingdomName,
        realm:    mission.targetRealm,
        region:   mission.targetRegion,
        slot:     mission.targetSlot,
        wood: 500, stone: 500, grain: 500,
        woodCapacity: 10000, stoneCapacity: 10000, grainCapacity: 10000,
        lastResourceUpdate: now,
      })
      await db.update(armyMissions).set({
        colonist: 0,
        state: 'returning', returnTime,
        result: JSON.stringify({ type: 'colonize', success: true, name: kingdomName }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))
    } else {
      await db.update(armyMissions).set({
        state: 'returning', returnTime,
        result: JSON.stringify({ type: 'colonize', success: false, reason: 'Posición ya ocupada' }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))
    }
    return
  }

  // ── Scavenge ──────────────────────────────────────────────────────────────────
  if (mType === 'scavenge') {
    const cargo = calcCargoCapacity(missionUnits)

    // Find debris at target coords
    const [debris] = await db.select().from(debrisFields)
      .where(and(
        eq(debrisFields.realm,  mission.targetRealm),
        eq(debrisFields.region, mission.targetRegion),
        eq(debrisFields.slot,   mission.targetSlot),
      )).limit(1)

    let collected = { wood: 0, stone: 0 }
    if (debris && cargo > 0) {
      const total = debris.wood + debris.stone
      const ratio = Math.min(1, cargo / total)
      collected.wood  = Math.floor(debris.wood  * ratio)
      collected.stone = Math.floor(debris.stone * ratio)

      const remaining = { wood: debris.wood - collected.wood, stone: debris.stone - collected.stone }
      if (remaining.wood < 1 && remaining.stone < 1) {
        await db.delete(debrisFields).where(eq(debrisFields.id, debris.id))
      } else {
        await db.update(debrisFields).set({
          wood: remaining.wood, stone: remaining.stone, updatedAt: new Date(),
        }).where(eq(debrisFields.id, debris.id))
      }
    }

    await db.update(armyMissions).set({
      state: 'returning', returnTime,
      woodLoad: collected.wood, stoneLoad: collected.stone,
      result: JSON.stringify({ type: 'scavenge', collected }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))
    return
  }

  // ── Deploy (one-way transfer to own kingdom) ─────────────────────────────────
  if (mType === 'deploy') {
    if (targetKingdom && targetKingdom.userId === myKingdom.userId) {
      const patch = { updatedAt: new Date() }
      for (const k of UNIT_KEYS) {
        if ((mission[k] ?? 0) > 0) patch[k] = (targetKingdom[k] ?? 0) + mission[k]
      }
      patch.wood  = (targetKingdom.wood  ?? 0) + (mission.woodLoad  ?? 0)
      patch.stone = (targetKingdom.stone ?? 0) + (mission.stoneLoad ?? 0)
      patch.grain = (targetKingdom.grain ?? 0) + (mission.grainLoad ?? 0)
      await db.update(kingdoms).set(patch).where(eq(kingdoms.id, targetKingdom.id))

      await db.update(armyMissions).set({
        state: 'completed',
        result: JSON.stringify({ type: 'deploy', success: true }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))

      await db.insert(messages).values({
        userId: myKingdom.userId,
        type:   'system',
        subject: `🚩 Despliegue llegó a ${targetKingdom.name}`,
        data:   JSON.stringify({ type: 'deploy', success: true, target: targetKingdom.name }),
      })
    } else {
      // Target no longer owned by player — return units
      await db.update(armyMissions).set({
        state: 'returning', returnTime,
        result: JSON.stringify({ type: 'deploy', success: false, reason: 'Reino ya no es tuyo' }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))
    }
    return
  }

  // ── Pillage (NPC-only quick raid) ─────────────────────────────────────────────
  if (mType === 'pillage') {
    let npcRes, npcStrength
    if (targetKingdom?.isNpc) {
      // Use real NPC resources from DB; strength based on npcLevel
      npcRes = { wood: targetKingdom.wood, stone: targetKingdom.stone, grain: targetKingdom.grain }
      npcStrength = (targetKingdom.npcLevel ?? 1) * 15000  // 15k / 30k / 45k
    } else {
      // Fallback: Wang hash estimate (pre-seeding)
      const seed = mission.targetRealm * 374761397 + mission.targetRegion * 1234567 + mission.targetSlot * 7654321
      npcStrength = ((seed ^ (seed >>> 16)) >>> 0) % 50000
      npcRes = {
        wood:  Math.floor(1000 + npcStrength * 0.5),
        stone: Math.floor(800  + npcStrength * 0.4),
        grain: Math.floor(600  + npcStrength * 0.1),
      }
    }

    const cargo = calcCargoCapacity(missionUnits)
    const loot  = calculateLoot(npcRes, cargo)

    // Small casualty chance based on NPC strength
    const casualtyRate = Math.min(0.15, npcStrength / 300000)
    const survivorPatch = {}
    for (const k of UNIT_KEYS) {
      const n = missionUnits[k] ?? 0
      if (n === 0) { survivorPatch[k] = 0; continue }
      let survivors = 0
      for (let i = 0; i < n; i++) {
        if (Math.random() >= casualtyRate) survivors++
      }
      survivorPatch[k] = survivors
    }

    // Deduct loot from real NPC kingdom resources
    if (targetKingdom?.isNpc && (loot.wood > 0 || loot.stone > 0 || loot.grain > 0)) {
      await db.update(kingdoms).set({
        wood:  Math.max(0, targetKingdom.wood  - loot.wood),
        stone: Math.max(0, targetKingdom.stone - loot.stone),
        grain: Math.max(0, targetKingdom.grain - loot.grain),
        updatedAt: new Date(),
      }).where(eq(kingdoms.id, targetKingdom.id))
    }

    const result = { type: 'pillage', loot, survivorPatch }

    await db.update(armyMissions).set({
      ...survivorPatch,
      state: 'returning', returnTime,
      woodLoad: loot.wood, stoneLoad: loot.stone, grainLoad: loot.grain,
      result: JSON.stringify(result),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))

    await db.insert(messages).values({
      userId: myKingdom.userId,
      type:   'battle',
      subject: `⚔️ Pillaje en R${mission.targetRealm}:${mission.targetRegion}:${mission.targetSlot}`,
      data:   JSON.stringify(result),
    })
    return
  }

  // ── Expedition ────────────────────────────────────────────────────────────────
  if (mType === 'expedition') {
    const [researchRow] = await db.select().from(research)
      .where(eq(research.userId, myKingdom.userId)).limit(1)

    const { outcome, result, unitPatch, returnTimeDelta, etherGained, destroyed } =
      resolveExpedition(missionUnits, researchRow ?? {}, travelSecs)

    // Black hole or lost combat — units destroyed, no return
    if (destroyed) {
      await db.update(armyMissions).set({
        state: 'completed',
        result: JSON.stringify({ type: 'expedition', outcome, ...result }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))

      await db.insert(messages).values({
        userId: myKingdom.userId,
        type:   'expedition',
        subject: outcome === 'black_hole'
          ? '🌀 Tormenta Arcana — tu flota ha desaparecido'
          : `⚔️ Tierras Ignotas — ${outcome === 'bandits' ? 'Merodeadores' : 'Bestias Oscuras'} — derrota`,
        data: JSON.stringify({ type: 'expedition', outcome, ...result }),
      })
      return
    }

    // Apply unit patch (units found in combat survivors or units found outcome)
    const finalUnits = { ...missionUnits }
    if (unitPatch) Object.assign(finalUnits, unitPatch)

    // Resources found
    const woodLoad  = result.found?.wood  ?? 0
    const stoneLoad = result.found?.stone ?? 0
    const grainLoad = result.found?.grain ?? 0

    const adjustedReturn = returnTime + returnTimeDelta

    await db.update(armyMissions).set({
      ...finalUnits,
      state: 'returning',
      returnTime: Math.max(now + 1, adjustedReturn),
      woodLoad, stoneLoad, grainLoad,
      result: JSON.stringify({ type: 'expedition', outcome, ...result }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, mission.id))

    // Ether reward
    if (etherGained > 0) {
      const [currentUser] = await db.select({ ether: users.ether })
        .from(users).where(eq(users.id, myKingdom.userId)).limit(1)
      await db.update(users)
        .set({ ether: (currentUser?.ether ?? 0) + etherGained })
        .where(eq(users.id, myKingdom.userId))
      await db.insert(etherTransactions).values({
        userId: myKingdom.userId,
        type: 'expedition',
        amount: etherGained,
        reason: 'Reliquias encontradas en las Tierras Ignotas',
      })
    }

    const outcomeLabels = {
      nothing: '🌑 Tierras Ignotas — expedición vacía',
      resources: '💰 Tierras Ignotas — botín abandonado',
      units: '⚔️ Tierras Ignotas — supervivientes encontrados',
      delay: '🌫️ Tierras Ignotas — caminos perdidos',
      speedup: '💨 Tierras Ignotas — viento favorable',
      bandits: '⚔️ Tierras Ignotas — Merodeadores — victoria',
      demons: '⚔️ Tierras Ignotas — Bestias Oscuras — victoria',
      ether: '✨ Tierras Ignotas — reliquias arcanas',
    }

    await db.insert(messages).values({
      userId: myKingdom.userId,
      type:   'expedition',
      subject: outcomeLabels[outcome] ?? '🌑 Tierras Ignotas — expedición completada',
      data: JSON.stringify({ type: 'expedition', outcome, ...result }),
    })
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

  // Resolve any arrived NPC attacks targeting this player's kingdoms
  const playerKingdoms = await db.select().from(kingdoms)
    .where(eq(kingdoms.userId, userId))
  const now2 = Math.floor(Date.now() / 1000)
  await resolveIncomingNpcAttacks(playerKingdoms, now2)

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
