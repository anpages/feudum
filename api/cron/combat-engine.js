/**
 * combat-engine — mission resolution + season management + IntrusionDetector.
 * Vercel Cron: every minute ("* * * * *").
 * Handles: NPC returns, scavenges, NPC-vs-NPC battles, expeditions, purge, season.
 * IntrusionDetector: sets npc_state.nextCheck=0 for NPCs with imminent attacks (ETA ≤ 15 min)
 * so npc-builder reacts on the next run.
 */
import { eq, and, lte, gte, lt, inArray } from 'drizzle-orm'
import { db, users, kingdoms, npcState, units, research, armyMissions } from '../_db.js'
import {
  buildBattleUnits, runBattle, calculateLoot,
  repairDefenses, calcCargoCapacity,
} from '../lib/battle.js'
import { insertBattleLog, sumLosses } from '../lib/battle_log.js'
import { processScavenge } from '../lib/missions/scavenge.js'
import { processSpy } from '../lib/missions/spy.js'
import { resolveExpedition } from '../lib/expedition.js'
import { getSettings, setSetting } from '../lib/settings.js'
import { startNewSeason, repairSeasonNpcsIfMissing } from '../lib/season.js'
import { upsertUnit } from '../lib/db-helpers.js'
import {
  NPC_UNIT_KEYS, NPC_DEFENSE_KEYS,
  npcClass, EMPTY_RESEARCH,
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

async function processNpcReturns(npcUserIds, npcKingdomsById, now) {
  const returning = await db.select().from(armyMissions)
    .where(and(
      inArray(armyMissions.userId, npcUserIds),
      eq(armyMissions.state,  'returning'),
      lte(armyMissions.returnTime, now),
    ))

  for (const m of returning) {
    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (!npcKingdom) {
      await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      continue
    }

    // Return units via upsertUnit (JSONB mission units)
    const missionUnits = m.units ?? {}
    for (const [u, n] of Object.entries(missionUnits)) {
      if (n > 0) await upsertUnit(npcKingdom.id, u, (npcKingdom[u] ?? 0) + n)
    }

    // Return resource loads
    const resourcePatch = { updatedAt: new Date() }
    if ((m.woodLoad  ?? 0) > 0) resourcePatch.wood  = Math.min((npcKingdom.wood  ?? 0) + m.woodLoad,  npcKingdom.woodCapacity)
    if ((m.stoneLoad ?? 0) > 0) resourcePatch.stone = Math.min((npcKingdom.stone ?? 0) + m.stoneLoad, npcKingdom.stoneCapacity)
    if ((m.grainLoad ?? 0) > 0) resourcePatch.grain = Math.min((npcKingdom.grain ?? 0) + m.grainLoad, npcKingdom.grainCapacity)

    if (Object.keys(resourcePatch).length > 1) {
      await db.update(kingdoms).set(resourcePatch).where(eq(kingdoms.id, npcKingdom.id))
      Object.assign(npcKingdom, resourcePatch)
    }

    if (m.missionType === 'expedition') {
      await db.update(armyMissions)
        .set({ state: 'completed', updatedAt: new Date() })
        .where(eq(armyMissions.id, m.id))
    } else {
      await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
    }
  }
}

// ── Resolve NPC-vs-NPC battles ────────────────────────────────────────────────

async function resolveNpcVsNpcAttacks(npcKingdomsById, researchByUser, now) {
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

      const missionUnits  = m.units ?? {}
      const atkResearch   = researchByUser[atkKingdom.userId] ?? EMPTY_RESEARCH
      const defResearch   = researchByUser[defKingdom.userId] ?? EMPTY_RESEARCH
      const attackerUnits = buildBattleUnits(missionUnits, atkResearch)

      // Build defender unit map from enriched kingdom (unit counts merged in)
      const allDefUnits = {}
      for (const k of [...NPC_UNIT_KEYS, ...NPC_DEFENSE_KEYS]) {
        const n = defKingdom[k] ?? 0
        if (n > 0) allDefUnits[k] = n
      }
      const defenderUnits = buildBattleUnits(allDefUnits, defResearch)

      const { outcome, rounds, survivingAtk, lostAtk, lostDef } = runBattle(attackerUnits, defenderUnits)
      const cargo = calcCargoCapacity(missionUnits)
      const loot  = outcome === 'victory'
        ? calculateLoot({ wood: defKingdom.wood, stone: defKingdom.stone, grain: defKingdom.grain }, cargo)
        : { wood: 0, stone: 0, grain: 0 }

      const travelSecs = m.arrivalTime - m.departureTime
      const returnTime = now + travelSecs

      // Update defender resources
      const defResourcePatch = { updatedAt: new Date() }
      if (outcome === 'victory') {
        defResourcePatch.wood  = Math.max(0, (defKingdom.wood  ?? 0) - loot.wood)
        defResourcePatch.stone = Math.max(0, (defKingdom.stone ?? 0) - loot.stone)
        defResourcePatch.grain = Math.max(0, (defKingdom.grain ?? 0) - loot.grain)
      }
      await db.update(kingdoms).set(defResourcePatch).where(eq(kingdoms.id, defKingdom.id))
      Object.assign(defKingdom, defResourcePatch)

      // Update defender units via upsertUnit
      const repaired = repairDefenses(Object.fromEntries(NPC_DEFENSE_KEYS.map(k => [k, lostDef[k] ?? 0])))
      for (const k of NPC_UNIT_KEYS) {
        const newQty = Math.max(0, (defKingdom[k] ?? 0) - (lostDef[k] ?? 0))
        await upsertUnit(defKingdom.id, k, newQty)
        defKingdom[k] = newQty
      }
      for (const k of NPC_DEFENSE_KEYS) {
        const newQty = Math.max(0, (defKingdom[k] ?? 0) - (lostDef[k] ?? 0) + (repaired[k] ?? 0))
        await upsertUnit(defKingdom.id, k, newQty)
        defKingdom[k] = newQty
      }

      if (outcome === 'victory') {
        await db.update(armyMissions).set({
          units: survivingAtk,
          state: 'returning', returnTime,
          woodLoad: loot.wood, stoneLoad: loot.stone, grainLoad: loot.grain,
          updatedAt: new Date(),
        }).where(eq(armyMissions.id, m.id))
      } else {
        await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      }

      await insertBattleLog({
        attackerKingdomId: atkKingdom.id, attackerName: atkKingdom.name,
        defenderKingdomId: defKingdom.id, defenderName: defKingdom.name,
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

async function resolveNpcExpeditions(npcUserIds, npcKingdomsById, now) {
  let resolved = 0

  // active → exploring
  const arrivedActive = await db.select({ id: armyMissions.id }).from(armyMissions).where(and(
    inArray(armyMissions.userId,      npcUserIds),
    eq(armyMissions.missionType, 'expedition'),
    eq(armyMissions.state,       'active'),
    lte(armyMissions.arrivalTime, now),
  ))
  if (arrivedActive.length > 0) {
    await db.update(armyMissions)
      .set({ state: 'exploring', updatedAt: new Date() })
      .where(and(
        inArray(armyMissions.userId,      npcUserIds),
        eq(armyMissions.missionType, 'expedition'),
        eq(armyMissions.state,       'active'),
        lte(armyMissions.arrivalTime, now),
      ))
  }

  // exploring → resolve → returning
  const exploring = await db.select().from(armyMissions).where(and(
    inArray(armyMissions.userId,      npcUserIds),
    eq(armyMissions.missionType, 'expedition'),
    eq(armyMissions.state,       'exploring'),
  ))

  if (exploring.length === 0) return resolved

  // top1Points is a scaling factor for expedition rewards — use 0 to avoid
  // expensive full-kingdom enrichment (all buildings would need loading)
  const top1Points = 0

  for (const m of exploring) {
    if (m.arrivalTime + (m.holdingTime ?? 0) > now) continue

    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (!npcKingdom) {
      await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
      continue
    }

    const missionUnits = m.units ?? {}

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
      units: finalUnits,
      state: 'returning', returnTime,
      woodLoad, stoneLoad, grainLoad,
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
// Sets npc_state.nextCheck = 0 → npc-builder will process them on its next run (fleetsave).

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
    const npcKingdom = npcKingdomsById[key]
    if (npcKingdom && !triggered.has(key)) {
      triggered.add(key)
      await db.update(npcState)
        .set({ nextCheck: 0, updatedAt: new Date() })
        .where(eq(npcState.userId, npcKingdom.userId))
    }
  }

  return triggered.size
}

// ── Resolve NPC spy missions ──────────────────────────────────────────────────

async function resolveNpcSpyMissions(npcUserIds, npcKingdomsById, now) {
  if (npcUserIds.length === 0) return 0

  const arrived = await db.select().from(armyMissions)
    .where(and(
      inArray(armyMissions.userId, npcUserIds),
      eq(armyMissions.missionType, 'spy'),
      eq(armyMissions.state,       'active'),
      lte(armyMissions.arrivalTime, now),
    ))

  let resolved = 0
  for (const m of arrived) {
    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (!npcKingdom) continue
    try {
      await processSpy(m, npcKingdom, now)
      resolved++
    } catch (err) {
      console.error('[combat-engine] NPC spy error:', err?.message ?? err)
    }
  }
  return resolved
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

  // Re-read settings: manageSeason may have activated a new season
  const cfgAfter = await getSettings()
  if (cfgAfter.season_state !== 'active') {
    return res.json({ ok: true, at: now, skipped: 'no_active_season', seasonAction })
  }

  const repairAction = await repairSeasonNpcsIfMissing(now)

  // Load all NPC kingdoms with their npcState
  const npcRows = await db.select({ k: kingdoms, ns: npcState })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .leftJoin(npcState, eq(npcState.userId, users.id))
    .where(eq(users.role, 'npc'))

  if (npcRows.length === 0) {
    return res.json({ ok: true, skipped: 'no_npc_kingdoms', seasonAction, repairAction })
  }

  const npcKingdomIds = npcRows.map(r => r.k.id)
  const npcUserIds    = npcRows.map(r => r.k.userId)

  // Batch load all NPC units and research
  const [allUnits, allResearch] = await Promise.all([
    db.select().from(units).where(inArray(units.kingdomId, npcKingdomIds)),
    db.select().from(research).where(inArray(research.userId, npcUserIds)),
  ])

  // Build unit map by kingdom id
  const unitsByKingdom = {}
  for (const u of allUnits) {
    if (!unitsByKingdom[u.kingdomId]) unitsByKingdom[u.kingdomId] = {}
    unitsByKingdom[u.kingdomId][u.type] = u.quantity
  }

  // Build research map by user id
  const researchByUser = {}
  for (const r of allResearch) {
    if (!researchByUser[r.userId]) researchByUser[r.userId] = {}
    researchByUser[r.userId][r.type] = r.level
  }

  // Enrich NPC kingdoms with unit counts and npcState fields
  const allNpcKingdoms = npcRows.map(({ k, ns }) => ({
    ...k,
    ...(unitsByKingdom[k.id] ?? {}),
    isBoss:    ns?.isBoss    ?? false,
    npcLevel:  ns?.npcLevel  ?? 1,
    nextCheck: ns?.nextCheck ?? null,
  }))

  // Index by coord key
  const npcKingdomsById = {}
  for (const k of allNpcKingdoms) {
    npcKingdomsById[`${k.realm}:${k.region}:${k.slot}`] = k
  }

  await processNpcReturns(npcUserIds, npcKingdomsById, now)
  const npcSpiesResolved = await resolveNpcSpyMissions(npcUserIds, npcKingdomsById, now)

  // Resolve arrived scavenges
  const arrivedScavenges = await db.select().from(armyMissions).where(and(
    inArray(armyMissions.userId,      npcUserIds),
    eq(armyMissions.missionType, 'scavenge'),
    eq(armyMissions.state,       'active'),
    lte(armyMissions.arrivalTime, now),
  ))
  for (const m of arrivedScavenges) {
    const npcKingdom = npcKingdomsById[`${m.startRealm}:${m.startRegion}:${m.startSlot}`]
    if (npcKingdom) await processScavenge(m, npcKingdom, now, null)
  }

  const npcVsNpcResolved       = await resolveNpcVsNpcAttacks(npcKingdomsById, researchByUser, now)
  const npcExpeditionsResolved = await resolveNpcExpeditions(npcUserIds, npcKingdomsById, now)
  const purged                 = await purgeOldExpeditions(now)
  const intruderCount          = await runIntrusionDetector(npcKingdomsById, now)

  // Persist tick for admin monitor
  const combatTick = { at: now, npcVsNpcResolved, npcExpeditionsResolved, npcSpiesResolved, purged, intruderCount }
  const MAX_HISTORY = 48
  let combatHistory = []
  try { const raw = cfg.combat_engine_tick_history; if (raw) combatHistory = JSON.parse(raw) } catch { combatHistory = [] }
  combatHistory.push(combatTick)
  if (combatHistory.length > MAX_HISTORY) combatHistory = combatHistory.slice(-MAX_HISTORY)
  await Promise.all([
    setSetting('combat_engine_last_tick',    JSON.stringify(combatTick)),
    setSetting('combat_engine_tick_history', JSON.stringify(combatHistory)),
  ])

  return res.json({
    ok: true,
    at: now,
    npcVsNpcResolved,
    npcExpeditionsResolved,
    npcSpiesResolved,
    purged,
    intruderCount,
    seasonAction,
    repairAction,
  })
}
