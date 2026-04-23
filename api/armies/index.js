import { eq, and, ne, or, inArray, sql } from 'drizzle-orm'
import { db, kingdoms, armyMissions, messages, users } from '../_db.js'
import { calcPoints } from '../lib/points.js'
import { getSessionUserId } from '../lib/handler.js'
import { resolveIncomingNpcAttacks } from '../lib/npc-resolve.js'
import { UNIT_KEYS } from '../lib/missions/keys.js'
import { processSpy }        from '../lib/missions/spy.js'
import { processTransport }  from '../lib/missions/transport.js'
import { processAttack }     from '../lib/missions/attack.js'
import { processColonize }   from '../lib/missions/colonize.js'
import { processScavenge }   from '../lib/missions/scavenge.js'
import { processDeploy }     from '../lib/missions/deploy.js'
import { processExpedition } from '../lib/missions/expedition.js'
import { processMissile }    from '../lib/missions/missile.js'
import { getResearchMap, getUnitMap, upsertUnit } from '../lib/db-helpers.js'

async function resolveTargetKingdom(mission) {
  const { getKingdomAt } = await import('../lib/db-helpers.js')
  return getKingdomAt(mission.targetRealm, mission.targetRegion, mission.targetSlot)
}

async function processArrival(mission, myKingdom, now) {
  const mType = mission.missionType

  if (mType === 'spy') {
    await processSpy(mission, myKingdom, now)
    return
  }

  const targetKingdom = await resolveTargetKingdom(mission)

  switch (mType) {
    case 'transport':  return processTransport(mission,  myKingdom, now, targetKingdom)
    case 'attack':     return processAttack(mission,     myKingdom, now, targetKingdom)
    case 'colonize':   return processColonize(mission,   myKingdom, now, targetKingdom)
    case 'scavenge':   return processScavenge(mission,   myKingdom, now, targetKingdom)
    case 'deploy':     return processDeploy(mission,     myKingdom, now, targetKingdom)
    case 'expedition':
      await db.update(armyMissions).set({ state: 'exploring', updatedAt: new Date() })
        .where(eq(armyMissions.id, mission.id))
      return
    case 'missile':    return processMissile(mission,    myKingdom, now, targetKingdom)
    default:
      await db.update(armyMissions).set({
        state: 'returning',
        returnTime: now + (mission.arrivalTime - mission.departureTime),
        updatedAt: new Date(),
      }).where(eq(armyMissions.id, mission.id))
  }
}

async function processReturn(mission, kingdom, now) {
  // Return units from JSONB field
  const missionUnits = mission.units ?? {}
  const currentUnitMap = await getUnitMap(kingdom.id)
  for (const [type, count] of Object.entries(missionUnits)) {
    if (count > 0) await upsertUnit(kingdom.id, type, (currentUnitMap[type] ?? 0) + count)
  }

  const patch = { updatedAt: new Date() }
  if (mission.woodLoad  > 0) patch.wood  = Math.min((kingdom.wood  ?? 0) + mission.woodLoad,  kingdom.woodCapacity)
  if (mission.stoneLoad > 0) patch.stone = Math.min((kingdom.stone ?? 0) + mission.stoneLoad, kingdom.stoneCapacity)
  if (mission.grainLoad > 0) patch.grain = Math.min((kingdom.grain ?? 0) + mission.grainLoad, kingdom.grainCapacity)

  if (Object.keys(patch).length > 1) {
    await db.update(kingdoms).set(patch).where(eq(kingdoms.id, kingdom.id))
    Object.assign(kingdom, patch)
  }

  // Expeditions are kept as 'completed' so the admin log can show results.
  // All other missions are deleted immediately on return.
  if (mission.missionType === 'expedition') {
    await db.update(armyMissions).set({ state: 'completed', updatedAt: new Date() })
      .where(eq(armyMissions.id, mission.id))
  } else {
    await db.delete(armyMissions).where(eq(armyMissions.id, mission.id))
  }
}

async function processMissions(userId, kingdom) {
  const now      = Math.floor(Date.now() / 1000)
  const missions = await db.select().from(armyMissions)
    .where(eq(armyMissions.userId, userId))

  let resolved = 0
  for (const m of missions) {
    if (m.state === 'active' && m.arrivalTime <= now) {
      await processArrival(m, kingdom, now)
      resolved++
    } else if (m.state === 'exploring' && m.arrivalTime + (m.holdingTime ?? 0) <= now) {
      await processExpedition(m, kingdom, now)
      resolved++
    } else if (m.state === 'returning' && m.returnTime && m.returnTime <= now) {
      await processReturn(m, kingdom, now)
      resolved++
    }
  }
  return resolved
}

async function expireMerchantOffers(userId, active, now) {
  for (const m of active) {
    if (m.state !== 'merchant') continue
    const parsed    = m.result ? JSON.parse(m.result) : null
    const expiresAt = parsed?.merchantOffer?.expiresAt ?? 0
    if (now < expiresAt) continue

    const [homeKingdom] = await db.select().from(kingdoms).where(and(
      eq(kingdoms.userId, userId),
      eq(kingdoms.realm,   m.startRealm),
      eq(kingdoms.region,  m.startRegion),
      eq(kingdoms.slot,    m.startSlot),
    )).limit(1)
    if (homeKingdom) {
      const currentUnitMap = await getUnitMap(homeKingdom.id)
      const missionUnits = m.units ?? {}
      for (const [type, count] of Object.entries(missionUnits)) {
        if (count > 0) await upsertUnit(homeKingdom.id, type, (currentUnitMap[type] ?? 0) + count)
      }
    }
    await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
    await db.insert(messages).values({
      userId, type: 'expedition',
      subject: '🏪 Mercader — oferta expirada',
      data: { type: 'expedition', outcome: 'merchant', expired: true },
    })
  }
}

// ── GET /api/armies ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const [[kingdomRow], resMap, [userRow]] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    getResearchMap(userId),
    db.select({ characterClass: users.characterClass }).from(users).where(eq(users.id, userId)).limit(1),
  ])
  if (!kingdomRow) return res.status(404).json({ error: 'Reino no encontrado' })
  const kingdom = kingdomRow

  const resolvedMissions = await processMissions(userId, kingdom)

  const playerKingdoms = await db.select().from(kingdoms).where(eq(kingdoms.userId, userId))
  const now = Math.floor(Date.now() / 1000)
  await resolveIncomingNpcAttacks(playerKingdoms, now)

  // Check achievements whenever a mission resolves (battle, spy, colonize, etc.)
  if (resolvedMissions > 0) {
    try {
      const { checkAndUnlock } = await import('../lib/achievements.js')
      await checkAndUnlock(userId)
    } catch { /* non-fatal */ }
  }

  const active = await db.select().from(armyMissions).where(eq(armyMissions.userId, userId))
  await expireMerchantOffers(userId, active, now)

  const missions = active
    .filter(m => m.state === 'active' || m.state === 'exploring' || m.state === 'returning' || m.state === 'merchant')
    .filter(m => {
      if (m.state !== 'merchant') return true
      const p = m.result ? JSON.parse(m.result) : null
      return now < (p?.merchantOffer?.expiresAt ?? 0)
    })
    .map(m => {
      const missionUnits = m.units ?? {}

      const eta = m.state === 'returning'
        ? Math.max(0, (m.returnTime ?? 0) - now)
        : m.state === 'merchant'
          ? 0
          : m.state === 'exploring'
            ? Math.max(0, m.arrivalTime + (m.holdingTime ?? 0) - now)
            : Math.max(0, m.arrivalTime - now)

      return {
        id: m.id,
        missionType: m.missionType,
        state: m.state,
        target: { realm: m.targetRealm, region: m.targetRegion, slot: m.targetSlot },
        origin: { realm: m.startRealm,  region: m.startRegion,  slot: m.startSlot },
        departureTime: m.departureTime,
        arrivalTime: m.arrivalTime,
        holdingTime: m.holdingTime ?? 0,
        returnTime:  m.returnTime,
        eta,
        units: missionUnits,
        resources: { wood: m.woodLoad ?? 0, stone: m.stoneLoad ?? 0, grain: m.grainLoad ?? 0 },
        result: m.result ? JSON.parse(m.result) : null,
      }
    })

  const logistics    = resMap.logistics ?? 0
  const maxSlots     = 1 + logistics
  const slotsUsed    = missions.filter(m => m.missionType !== 'missile').length

  // Fetch all human kingdoms for top1Points calculation
  const allHumanKingdoms = await db
    .select({ k: kingdoms })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .where(ne(users.role, 'npc'))
  const top1Points   = allHumanKingdoms.reduce((max, r) => Math.max(max, calcPoints(r.k)), 0)
  const characterClass = userRow?.characterClass ?? null

  // ── Incoming enemy missions ───────────────────────────────────────────────
  const HOSTILE_TYPES = new Set(['attack', 'spy', 'missile'])
  let incomingMissions = []
  let underAttack = false

  if (playerKingdoms.length > 0) {
    const targetConditions = playerKingdoms.map(k =>
      and(
        eq(armyMissions.targetRealm, k.realm),
        eq(armyMissions.targetRegion, k.region),
        eq(armyMissions.targetSlot,   k.slot),
      )
    )
    const incomingRaw = await db.select().from(armyMissions).where(
      and(
        ne(armyMissions.userId, userId),
        eq(armyMissions.state, 'active'),
        or(...targetConditions),
      )
    )

    if (incomingRaw.length > 0) {
      const attackerUserIds = [...new Set(incomingRaw.map(m => m.userId))]
      const attackerKingdoms = await db.select({
        userId: kingdoms.userId,
        realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
        name: kingdoms.name,
      }).from(kingdoms).where(inArray(kingdoms.userId, attackerUserIds))

      const nameByCoord = {}
      for (const k of attackerKingdoms) nameByCoord[`${k.realm}:${k.region}:${k.slot}`] = k.name

      incomingMissions = incomingRaw.map(m => ({
        id: m.id,
        missionType: m.missionType,
        state: 'active',
        origin: { realm: m.startRealm,  region: m.startRegion,  slot: m.startSlot },
        target: { realm: m.targetRealm, region: m.targetRegion, slot: m.targetSlot },
        arrivalTime: m.arrivalTime,
        eta: Math.max(0, m.arrivalTime - now),
        units: m.units ?? {},
        threatLevel: HOSTILE_TYPES.has(m.missionType) ? 'hostile' : 'neutral',
        attackerName: nameByCoord[`${m.startRealm}:${m.startRegion}:${m.startSlot}`] ?? null,
      }))

      underAttack = incomingMissions.some(m => m.threatLevel === 'hostile')
    }
  }

  return res.json({ missions, incomingMissions, underAttack, fleetSlots: { used: slotsUsed, max: maxSlots }, top1Points, characterClass })
}
