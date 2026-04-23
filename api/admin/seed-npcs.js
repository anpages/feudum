import { eq } from 'drizzle-orm'
import { db, users, kingdoms } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { seedNpcs } from '../lib/season.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  const { action } = req.body ?? {}
  if (!['seed_npcs', 'reset_npcs'].includes(action)) {
    return res.status(400).json({ error: 'unknown_action' })
  }

  // Reset: delete all NPC users (cascades kingdoms, buildings, units, research, npcState)
  if (action === 'reset_npcs') {
    const deleted = await db.delete(users)
      .where(eq(users.role, 'npc'))
      .returning({ id: users.id })
    return res.json({ ok: true, deleted: deleted.length, created: 0 })
  }

  // Seed: add NPCs to existing map
  const now = Math.floor(Date.now() / 1000)

  // Build takenSlots from all existing kingdoms
  const existing = await db.select({
    realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
  }).from(kingdoms)
  const takenSlots = new Set(existing.map(k => `${k.realm}:${k.region}:${k.slot}`))

  const seeded = await seedNpcs(takenSlots, now)
  return res.json({ ok: true, deleted: 0, created: seeded })
}
