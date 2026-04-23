/**
 * combat-engine — mission resolution + season management + IntrusionDetector.
 * Vercel Cron: every minute ("* * * * *").
 * Handles: NPC returns, scavenges, NPC-vs-NPC battles, expeditions, purge, season.
 * IntrusionDetector: sets npcNextCheck=0 for NPCs with imminent attacks (ETA ≤ 15 min)
 * so npc-builder reacts on the next run.
 */
import { eq, and, lte, gte, lt, or } from 'drizzle-orm'
import { db, users, kingdoms, armyMissions } from '../_db.js'
import {
  buildBattleUnits, runBattle, calculateLoot,
  repairDefenses, calcCargoCapacity,
} from '../lib/battle.js'
import { insertBattleLog, sumLosses } from '../lib/battle_log.js'
import { processScavenge } from '../lib/missions/scavenge.js'
import { resolveExpedition } from '../lib/expedition.js'
import { calcPoints } from '../lib/points.js'
import { getSettings, setSetting } from '../lib/settings.js'
import { startNewSeason, repairSeasonNpcsIfMissing } from '../lib/season.js'
import {
  UNIT_KEYS, NPC_UNIT_KEYS, NPC_DEFENSE_KEYS,
  npcClass, npcResearch, extractK,
} from '../lib/npc-engine.js'

// ── Season management ─────────────────────────────────────────────────────────

async function manageSeason(cfg, now) {
  const seasonState  = cfg.season_state  ?? null
  const seasonEnd    = parseInt(cfg.season_end ?? '0', 10)
  const seasonNumber = parseInt(cfg.season_number ?? '0', 10)

  if (!seasonState || seasonState === '') {
    const result = await startNewSeason(1, cfg.economy_speed)
    return { action: 'bootstrap', season: 1, ...result }
  }

  if (seasonState === 'active' && seasonEnd > 0 && now > seasonEnd) {
    const winnerCondition = cfg.season_winner_condition ?? ''
    if (!winnerCondition || winnerCondition === '') {
      await setSetting('season_winner_condition', 'points')
    }
    const nextNumber = seasonNumber + 1
    const result = await startNewSeason(nextNumber, cfg.economy_speed)
    return { action: 'transition', from: seasonNumber, to: nextNumber, ...result }
  }

  return null
}

// ── Process NPC return missions ───────────────────────────────────────────────

async function processNpcReturns(npcUserId, npcKingdomsById, now) {
  const returning = await db.select().from(armyMissions)
    .where(and(
      eq(armyMissions.userId, npcUserId),
      eq(armyMissions.state,  'returning'),
      lte(armyMissions.returnTime, now),
    ))

  for (const m of returning) {
    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (!npcKingdom) {
      await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      continue
    }

    const patch = { updatedAt: new Date() }
    for (const u of UNIT_KEYS) {
      const n = m[u] ?? 0
      if (n > 0) patch[u] = (npcKingdom[u] ?? 0) + n
    }
    if ((m.woodLoad  ?? 0) > 0) patch.wood  = Math.min((npcKingdom.wood  ?? 0) + m.woodLoad,  npcKingdom.woodCapacity)
    if ((m.stoneLoad ?? 0) > 0) patch.stone = Math.min((npcKingdom.stone ?? 0) + m.stoneLoad, npcKingdom.stoneCapacity)
    if ((m.grainLoad ?? 0) > 0) patch.grain = Math.min((npcKingdom.grain ?? 0) + m.grainLoad, npcKingdom.grainCapacity)

    await db.update(kingdoms).set(patch).where(eq(kingdoms.id, npcKingdom.id))

    if (m.missionType === 'expedition') {
      await db.update(armyMissions)
        .set({ state: 'completed', updatedAt: new Date() })
        .where(eq(armyMissions.id, m.id))
    } else {
      await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
    }
    Object.assign(npcKingdom, patch)
  }
}

// ── Resolve NPC-vs-NPC battles ────────────────────────────────────────────────

async function resolveNpcVsNpcAttacks(npcKingdomsById, now) {
  let resolved = 0

  const arrivedAll = await db.select().from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'attack'),
      eq(armyMissions.state,       'active'),
      lte(armyMissions.arrivalTime, now),
    ))

  const byDefender = {}
  for (const m of arrivedAll) {
    const defKey = `${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`
    if (!npcKingdomsById[defKey]) continue
    if (!byDefender[defKey]) byDefender[defKey] = []
    byDefender[defKey].push(m)
  }

  for (const [defKey, missions] of Object.entries(byDefender)) {
    const defKingdom = npcKingdomsById[defKey]

    for (const m of missions) {
      const atkKey = `${m.startRealm}:${m.startRegion}:${m.startSlot}`
      const atkKingdom = npcKingdomsById[atkKey]
      if (!atkKingdom) continue  // player-initiated attack, handled by resolveIncomingNpcAttacks

      const missionUnits  = extractK(m, NPC_UNIT_KEYS)
      const atkResearch   = npcResearch(atkKingdom)
      const defResearch   = npcResearch(defKingdom)
      const attackerUnits = buildBattleUnits(missionUnits, atkResearch)
      const defenderUnits = buildBattleUnits(
        { ...extractK(defKingdom, NPC_UNIT_KEYS), ...extractK(defKingdom, NPC_DEFENSE_KEYS) }, defResearch
      )

      const { outcome, rounds, survivingAtk, lostAtk, lostDef } = runBattle(attackerUnits, defenderUnits)
      const cargo = calcCargoCapacity(missionUnits)
      const loot  = outcome === 'victory'
        ? calculateLoot({ wood: defKingdom.wood, stone: defKingdom.stone, grain: defKingdom.grain }, cargo)
        : { wood: 0, stone: 0, grain: 0 }

      const travelSecs = m.arrivalTime - m.departureTime
      const returnTime = now + travelSecs

      const defPatch = { updatedAt: new Date() }
      if (outcome === 'victory') {
        defPatch.wood  = Math.max(0, (defKingdom.wood  ?? 0) - loot.wood)
        defPatch.stone = Math.max(0, (defKingdom.stone ?? 0) - loot.stone)
        defPatch.grain = Math.max(0, (defKingdom.grain ?? 0) - loot.grain)
      }
      const repaired = repairDefenses(Object.fromEntries(NPC_DEFENSE_KEYS.map(k => [k, lostDef[k] ?? 0])))
      for (const k of NPC_UNIT_KEYS)    defPatch[k] = Math.max(0, (defKingdom[k] ?? 0) - (lostDef[k] ?? 0))
      for (const k of NPC_DEFENSE_KEYS) defPatch[k] = Math.max(0, (defKingdom[k] ?? 0) - (lostDef[k] ?? 0) + (repaired[k] ?? 0))
      await db.update(kingdoms).set(defPatch).where(eq(kingdoms.id, defKingdom.id))
      Object.assign(defKingdom, defPatch)

      if (outcome === 'victory') {
        const survivorPatch = {}
        for (const k of NPC_UNIT_KEYS) survivorPatch[k] = survivingAtk[k] ?? 0
        await db.update(armyMissions).set({
          ...survivorPatch, state: 'returning', returnTime,
          woodLoad: loot.wood, stoneLoad: loot.stone, grainLoad: loot.grain,
          updatedAt: new Date(),
        }).where(eq(armyMissions.id, m.id))
      } else {
        await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      }

      await insertBattleLog({
        attackerKingdomId: atkKingdom.id, attackerName: atkKingdom.name, attackerIsNpc: true,
        defenderKingdomId: defKingdom.id, defenderName: defKingdom.name, defenderIsNpc: true,
        missionType: 'attack', outcome,
        lootWood: loot.wood, lootStone: loot.stone, lootGrain: loot.grain,
        attackerLosses: sumLosses(lostAtk), defenderLosses: sumLosses(lostDef), rounds,
        attackerCoord: atkKey,
        defenderCoord: `${m.targetRealm}:${m.targetRegion}:${m.targetSlot}`,
      })

      resolved++
    }
  }
  return resolved
}

// ── Resolve NPC expeditions ───────────────────────────────────────────────────

async function resolveNpcExpeditions(npcUserId, npcKingdomsById, now) {
  let resolved = 0

  // active → exploring
  const arrivedActive = await db.select({ id: armyMissions.id }).from(armyMissions).where(and(
    eq(armyMissions.userId,      npcUserId),
    eq(armyMissions.missionType, 'expedition'),
    eq(armyMissions.state,       'active'),
    lte(armyMissions.arrivalTime, now),
  ))
  if (arrivedActive.length > 0) {
    await db.update(armyMissions)
      .set({ state: 'exploring', updatedAt: new Date() })
      .where(and(
        eq(armyMissions.userId,      npcUserId),
        eq(armyMissions.missionType, 'expedition'),
        eq(armyMissions.state,       'active'),
        lte(armyMissions.arrivalTime, now),
      ))
  }

  // exploring → resolve → returning
  const exploring = await db.select().from(armyMissions).where(and(
    eq(armyMissions.userId,      npcUserId),
    eq(armyMissions.missionType, 'expedition'),
    eq(armyMissions.state,       'exploring'),
  ))

  if (exploring.length === 0) return resolved

  const allKingdoms = await db.select().from(kingdoms)
  const top1Points = allKingdoms.reduce((max, k) => Math.max(max, calcPoints(k)), 0)

  for (const m of exploring) {
    if (m.arrivalTime + (m.holdingTime ?? 0) > now) continue

    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (!npcKingdom) {
      await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      continue
    }

    const missionUnits = {}
    for (const k of UNIT_KEYS) missionUnits[k] = m[k] ?? 0

    const travelSecs = m.arrivalTime - m.departureTime
    const cls        = npcClass(npcKingdom)
    const isDisc     = cls === 'discoverer'

    const { outcome, result, unitPatch, returnTimeDelta, destroyed } =
      resolveExpedition(missionUnits, {}, travelSecs, now, {
        top1Points,
        combatMultiplier: isDisc ? 0.5 : 1.0,
        holdingTime: m.holdingTime ?? 0,
        discoverer: isDisc,
      })

    const effectiveOutcome = (outcome === 'merchant') ? 'resources' : outcome

    const returnTime = Math.max(now + 1,
      m.arrivalTime + (m.holdingTime ?? 0) + travelSecs + (returnTimeDelta ?? 0))

    if (destroyed) {
      await db.update(armyMissions).set({
        state:  'completed',
        result: JSON.stringify({ type: 'expedition', outcome: effectiveOutcome }),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, m.id))
      resolved++
      continue
    }

    const finalUnits = { ...missionUnits }
    if (unitPatch) Object.assign(finalUnits, unitPatch)

    let woodLoad = 0, stoneLoad = 0, grainLoad = 0
    if (effectiveOutcome === 'resources' && result.found) {
      woodLoad  = result.found.wood  ?? 0
      stoneLoad = result.found.stone ?? 0
      grainLoad = result.found.grain ?? 0
    }
    if (outcome === 'ether' && result.amount) grainLoad = result.amount * 10

    await db.update(armyMissions).set({
      ...finalUnits, state: 'returning',
      returnTime, woodLoad, stoneLoad, grainLoad,
      result: JSON.stringify({ type: 'expedition', outcome: effectiveOutcome }),
      updatedAt: new Date(),
    }).where(eq(armyMissions.id, m.id))

    resolved++
  }

  return resolved
}

// ── Purge old completed expeditions ──────────────────────────────────────────

async function purgeOldExpeditions(now) {
  const cutoff = now - 7 * 86400
  const { rowCount } = await db.delete(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'expedition'),
      eq(armyMissions.state,       'completed'),
      lt(armyMissions.departureTime, cutoff),
    ))
  return rowCount ?? 0
}

// ── IntrusionDetector ─────────────────────────────────────────────────────────
// Finds incoming attacks with ETA ≤ 15 min targeting NPC kingdoms.
// Sets npcNextCheck = 0 → npc-builder will process them on its next run (fleetsave).

async function runIntrusionDetector(npcKingdomsById, now) {
  const eta15 = now + 900  // 15 min window

  const incomingAttacks = await db.select({
    targetRealm:  armyMissions.targetRealm,
    targetRegion: armyMissions.targetRegion,
    targetSlot:   armyMissions.targetSlot,
  }).from(armyMissions)
    .where(and(
      eq(armyMissions.missionType, 'attack'),
      eq(armyMissions.state,       'active'),
      gte(armyMissions.arrivalTime, now),       // not yet arrived
      lte(armyMissions.arrivalTime, eta15),     // arrives within 15 min
    ))

  const triggered = new Set()
  for (const r of incomingAttacks) {
    const key = `${r.targetRealm}:${r.targetRegion}:${r.targetSlot}`
    if (npcKingdomsById[key] && !triggered.has(key)) {
      triggered.add(key)
      await db.update(kingdoms)
        .set({ npcNextCheck: 0, updatedAt: new Date() })
        .where(eq(kingdoms.id, npcKingdomsById[key].id))
    }
  }

  return triggered.size
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const now = Math.floor(Date.now() / 1000)
  const cfg = await getSettings()

  const seasonAction = await manageSeason(cfg, now)
  const repairAction = await repairSeasonNpcsIfMissing(now)

  const [npcUser] = await db.select({ id: users.id })
    .from(users).where(eq(users.isNpc, true)).limit(1)
  if (!npcUser) return res.json({ ok: true, skipped: 'no_npc_user', seasonAction, repairAction })

  const npcUserId = npcUser.id

  const allNpcKingdoms = await db.select().from(kingdoms)
    .where(eq(kingdoms.isNpc, true))

  if (allNpcKingdoms.length === 0) {
    return res.json({ ok: true, skipped: 'no_npc_kingdoms', seasonAction, repairAction })
  }

  const npcKingdomsById = {}
  for (const k of allNpcKingdoms) npcKingdomsById[`${k.realm}:${k.region}:${k.slot}`] = k

  await processNpcReturns(npcUserId, npcKingdomsById, now)

  // Resolve arrived scavenges
  const arrivedScavenges = await db.select().from(armyMissions).where(and(
    eq(armyMissions.userId,      npcUserId),
    eq(armyMissions.missionType, 'scavenge'),
    eq(armyMissions.state,       'active'),
    lte(armyMissions.arrivalTime, now),
  ))
  for (const m of arrivedScavenges) {
    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (npcKingdom) await processScavenge(m, npcKingdom, now, null)
  }

  const npcVsNpcResolved     = await resolveNpcVsNpcAttacks(npcKingdomsById, now)
  const npcExpeditionsResolved = await resolveNpcExpeditions(npcUserId, npcKingdomsById, now)
  const purged               = await purgeOldExpeditions(now)
  const intruderCount        = await runIntrusionDetector(npcKingdomsById, now)

  return res.json({
    ok: true,
    at: now,
    npcVsNpcResolved,
    npcExpeditionsResolved,
    purged,
    intruderCount,
    seasonAction,
    repairAction,
  })
}
