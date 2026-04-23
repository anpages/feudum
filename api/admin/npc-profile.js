import { eq, and, or, desc, gte } from 'drizzle-orm'
import { db, armyMissions, battleLog } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { calcPoints } from '../lib/points.js'
import { getKingdomAt, enrichKingdom } from '../lib/db-helpers.js'

function npcPersonality(k) {
  const h = ((k.realm * 374761 + k.region * 6271 + k.slot * 1013) >>> 0) % 3
  return ['economy', 'military', 'balanced'][h]
}

function npcClass(k) {
  const h = ((k.realm * 571349 + k.region * 31337 + k.slot * 9901) >>> 0) % 3
  return ['collector', 'general', 'discoverer'][h]
}

function npcVirtualResearch(k) {
  const b = k.barracks ?? 0
  const a = k.academy  ?? 0
  const r = k.armoury  ?? 0
  return {
    horsemanship:      b,
    swordsmanship:     b,
    fortification:     r,
    armoury:           r,
    cartography:       a,
    tradeRoutes:       Math.max(0, a - 2),
    alchemy:           a,
    pyromancy:         Math.max(0, a - 1),
    runemastery:       Math.max(0, a - 3),
    mysticism:         Math.max(0, a - 4),
    dragonlore:        Math.max(0, a - 7),
    spycraft:          a,
    logistics:         a,
    exploration:       a,
    diplomaticNetwork: a,
    divineBlessing:    Math.max(0, a - 9),
  }
}

export default async function handler(req, res) {
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })
  if (req.method !== 'GET') return res.status(405).end()

  const realm  = parseInt(req.query.realm  ?? '0', 10)
  const region = parseInt(req.query.region ?? '0', 10)
  const slot   = parseInt(req.query.slot   ?? '0', 10)

  if (!realm || !region || !slot) {
    return res.status(400).json({ error: 'Coordenadas inválidas' })
  }

  const now   = Math.floor(Date.now() / 1000)
  const since = now - 7 * 86400
  const coord = `${realm}:${region}:${slot}`

  const kingdom = await getKingdomAt(realm, region, slot)

  if (!kingdom) return res.status(404).json({ error: 'No hay reino en esas coordenadas' })

  // Enrich with buildings + units for calcPoints and npcVirtualResearch
  const enriched = await enrichKingdom(kingdom, { withUnits: true })

  const [activeMissions, recentMissions, battles] = await Promise.all([
    // Active/exploring/returning missions launched FROM or heading TO this slot
    db.select().from(armyMissions)
      .where(and(
        or(
          and(eq(armyMissions.startRealm, realm), eq(armyMissions.startRegion, region), eq(armyMissions.startSlot, slot)),
          and(eq(armyMissions.targetRealm, realm), eq(armyMissions.targetRegion, region), eq(armyMissions.targetSlot, slot)),
        ),
        or(eq(armyMissions.state, 'active'), eq(armyMissions.state, 'exploring'), eq(armyMissions.state, 'returning'), eq(armyMissions.state, 'merchant')),
      ))
      .orderBy(desc(armyMissions.departureTime))
      .limit(50),

    // Completed missions dispatched FROM this slot in the last 7 days
    db.select().from(armyMissions)
      .where(and(
        eq(armyMissions.startRealm, realm), eq(armyMissions.startRegion, region), eq(armyMissions.startSlot, slot),
        eq(armyMissions.state, 'completed'),
        gte(armyMissions.departureTime, since),
      ))
      .orderBy(desc(armyMissions.departureTime))
      .limit(60),

    // Battle log where this coord is attacker or defender
    db.select().from(battleLog)
      .where(or(eq(battleLog.attackerCoord, coord), eq(battleLog.defenderCoord, coord)))
      .orderBy(desc(battleLog.createdAt))
      .limit(60),
  ])

  return res.json({
    kingdom: enriched,
    personality:     enriched.isNpc ? npcPersonality(enriched) : null,
    npcClass:        enriched.isNpc ? npcClass(enriched)        : null,
    virtualResearch: enriched.isNpc ? npcVirtualResearch(enriched) : null,
    points:          calcPoints(enriched),
    activeMissions,
    recentMissions,
    battles,
    now,
  })
}
