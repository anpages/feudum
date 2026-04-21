import { eq, and, ne } from 'drizzle-orm'
import { db, kingdoms, armyMissions, messages, research } from '../_db.js'
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

async function resolveTargetKingdom(mission) {
  const [target] = await db.select().from(kingdoms).where(and(
    eq(kingdoms.realm,  mission.targetRealm),
    eq(kingdoms.region, mission.targetRegion),
    eq(kingdoms.slot,   mission.targetSlot),
  )).limit(1)
  return target ?? null
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

    case 'expedition': return processExpedition(mission, myKingdom, now)
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
  const patch = { updatedAt: new Date() }

  for (const k of UNIT_KEYS) {
    const count = mission[k] ?? 0
    if (count > 0) patch[k] = (kingdom[k] ?? 0) + count
  }

  if (mission.woodLoad  > 0) patch.wood  = Math.min((kingdom.wood  ?? 0) + mission.woodLoad,  kingdom.woodCapacity)
  if (mission.stoneLoad > 0) patch.stone = Math.min((kingdom.stone ?? 0) + mission.stoneLoad, kingdom.stoneCapacity)
  if (mission.grainLoad > 0) patch.grain = Math.min((kingdom.grain ?? 0) + mission.grainLoad, kingdom.grainCapacity)

  // Artifacts from battle victory (stored in result JSON)
  if (mission.result && kingdom.civilization) {
    try {
      const r = JSON.parse(mission.result)
      if (r.artifactsGained > 0) {
        patch.artifacts = Math.min(3600, (kingdom.artifacts ?? 0) + r.artifactsGained)
      }
    } catch { /* ignore */ }
  }

  await db.update(kingdoms).set(patch).where(eq(kingdoms.id, kingdom.id))
  Object.assign(kingdom, patch)
  await db.delete(armyMissions).where(eq(armyMissions.id, mission.id))
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

    const patch = { updatedAt: new Date() }
    const [homeKingdom] = await db.select().from(kingdoms).where(and(
      eq(kingdoms.userId, userId),
      eq(kingdoms.realm,   m.startRealm),
      eq(kingdoms.region,  m.startRegion),
      eq(kingdoms.slot,    m.startSlot),
    )).limit(1)
    if (homeKingdom) {
      for (const k of UNIT_KEYS) {
        const n = m[k] ?? 0
        if (n > 0) patch[k] = (homeKingdom[k] ?? 0) + n
      }
      await db.update(kingdoms).set(patch).where(eq(kingdoms.id, homeKingdom.id))
    }
    await db.delete(armyMissions).where(eq(armyMissions.id, m.id))
    await db.insert(messages).values({
      userId, type: 'expedition',
      subject: '🏪 Mercader — oferta expirada',
      data: JSON.stringify({ type: 'expedition', outcome: 'merchant', expired: true }),
    })
  }
}

// ── GET /api/armies ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const [[kingdom], [researchRow]] = await Promise.all([
    db.select().from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    db.select({ logistics: research.logistics }).from(research).where(eq(research.userId, userId)).limit(1),
  ])
  if (!kingdom) return res.status(404).json({ error: 'Reino no encontrado' })

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
    .filter(m => m.state === 'active' || m.state === 'returning' || m.state === 'merchant')
    .filter(m => {
      if (m.state !== 'merchant') return true
      const p = m.result ? JSON.parse(m.result) : null
      return now < (p?.merchantOffer?.expiresAt ?? 0)
    })
    .map(m => {
      const missionUnits = {}
      for (const k of UNIT_KEYS) if ((m[k] ?? 0) > 0) missionUnits[k] = m[k]
      if (m.missionType === 'missile' && (m.ballistic ?? 0) > 0) missionUnits.ballistic = m.ballistic

      const eta = m.state === 'returning'
        ? Math.max(0, (m.returnTime ?? 0) - now)
        : m.state === 'merchant'
          ? 0
          : Math.max(0, m.arrivalTime - now)

      return {
        id: m.id,
        missionType: m.missionType,
        state: m.state,
        target: { realm: m.targetRealm, region: m.targetRegion, slot: m.targetSlot },
        origin: { realm: m.startRealm,  region: m.startRegion,  slot: m.startSlot },
        arrivalTime: m.arrivalTime,
        returnTime:  m.returnTime,
        eta,
        units: missionUnits,
        resources: { wood: m.woodLoad ?? 0, stone: m.stoneLoad ?? 0, grain: m.grainLoad ?? 0 },
        result: m.result ? JSON.parse(m.result) : null,
      }
    })

  const logistics  = researchRow?.logistics ?? 0
  const maxSlots   = 1 + logistics
  const slotsUsed  = missions.filter(m => m.missionType !== 'missile').length

  return res.json({ missions, fleetSlots: { used: slotsUsed, max: maxSlots } })
}
