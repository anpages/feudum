/**
 * POST /api/season/join — player enrolls in the active season.
 * Assigns a random free slot and creates their first kingdom.
 * Idempotent: returns existing kingdom if already joined.
 */
import { eq, ne } from 'drizzle-orm'
import { db, users, kingdoms, buildings } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'
import { getSettings } from '../lib/settings.js'
import { UNIVERSE } from '../lib/config.js'
import { randomTempForSlot } from '../lib/buildings.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const cfg = await getSettings()
  if (cfg.season_state !== 'active') {
    return res.status(400).json({ error: 'no_active_season' })
  }

  // Check if already has a kingdom
  const [existing] = await db.select({ id: kingdoms.id })
    .from(kingdoms)
    .where(eq(kingdoms.userId, userId))
    .limit(1)

  if (existing) {
    return res.status(400).json({ error: 'already_joined', kingdomId: existing.id })
  }

  // Verify user exists and is human (not NPC)
  const [userRow] = await db.select({ id: users.id, username: users.username, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userRow || userRow.role === 'npc') return res.status(403).json({ error: 'forbidden' })

  // Find all taken slots
  const allKingdoms = await db.select({ realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot })
    .from(kingdoms)

  const takenSlots = new Set(allKingdoms.map(k => `${k.realm}:${k.region}:${k.slot}`))

  // Build list of free slots
  const { maxRealm, maxRegion, maxSlot } = UNIVERSE
  const available = []
  for (let realm = 1; realm <= maxRealm; realm++)
    for (let region = 1; region <= maxRegion; region++)
      for (let slot = 1; slot <= maxSlot; slot++)
        if (!takenSlots.has(`${realm}:${region}:${slot}`))
          available.push({ realm, region, slot })

  if (available.length === 0) {
    return res.status(503).json({ error: 'no_slots_available' })
  }

  // Pick random free slot
  const pos = available[Math.floor(Math.random() * available.length)]
  const now = Math.floor(Date.now() / 1000)

  const kingdomName = `Reino de ${userRow.username ?? 'Jugador'}`

  const { tempMin, tempMax } = randomTempForSlot(pos.slot)

  const [kingdom] = await db.insert(kingdoms)
    .values({
      userId:  userId,
      name:    kingdomName,
      realm:   pos.realm,
      region:  pos.region,
      slot:    pos.slot,
      tempMin, tempMax,
      wood:  500, stone: 500, grain: 500,
      woodCapacity: 10000, stoneCapacity: 10000, grainCapacity: 10000,
      woodProduction: 0, stoneProduction: 0, grainProduction: 0,
      lastResourceUpdate: now,
    })
    .returning()

  // Insert starting windmill
  await db.insert(buildings).values({ kingdomId: kingdom.id, type: 'windmill', level: 1 })

  return res.json({ ok: true, kingdom })
}
