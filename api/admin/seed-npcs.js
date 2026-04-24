import { eq } from 'drizzle-orm'
import { db, users, kingdoms } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { seedNpcs } from '../lib/season.js'

const DEBUG_NPC_COUNT = 50

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  const { action } = req.body ?? {}
  if (!['seed_npcs', 'reset_npcs', 'debug_reset_seed', 'add_one_npc'].includes(action)) {
    return res.status(400).json({ error: 'unknown_action' })
  }

  // Reset: delete all NPC users (cascades kingdoms, buildings, units, research, npcState)
  if (action === 'reset_npcs') {
    const deleted = await db.delete(users)
      .where(eq(users.role, 'npc'))
      .returning({ id: users.id })
    return res.json({ ok: true, deleted: deleted.length, created: 0 })
  }

  // Seed: add NPCs to existing map (full density)
  if (action === 'seed_npcs') {
    const now = Math.floor(Date.now() / 1000)
    const existing = await db.select({
      realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
    }).from(kingdoms)
    const takenSlots = new Set(existing.map(k => `${k.realm}:${k.region}:${k.slot}`))
    const seeded = await seedNpcs(takenSlots, now)
    return res.json({ ok: true, deleted: 0, created: seeded })
  }

  // Debug reset+seed: wipe all NPCs → exactly 50 regular NPCs, no boss
  if (action === 'debug_reset_seed') {
    const now = Math.floor(Date.now() / 1000)

    // 1. Delete all existing NPCs
    const deleted = await db.delete(users)
      .where(eq(users.role, 'npc'))
      .returning({ id: users.id })

    // 2. Build taken-slots from remaining human kingdoms
    const existing = await db.select({
      realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
    }).from(kingdoms)
    const takenSlots = new Set(existing.map(k => `${k.realm}:${k.region}:${k.slot}`))

    // 3. Seed exactly 50 regular NPCs (no boss in debug mode)
    const seeded = await seedNpcs(takenSlots, now, DEBUG_NPC_COUNT)

    return res.json({ ok: true, deleted: deleted.length, npcsCreated: seeded })
  }

  // Add one NPC to a random empty slot
  if (action === 'add_one_npc') {
    const now = Math.floor(Date.now() / 1000)
    const existing = await db.select({
      realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot,
    }).from(kingdoms)
    const takenSlots = new Set(existing.map(k => `${k.realm}:${k.region}:${k.slot}`))
    const seeded = await seedNpcs(takenSlots, now, 1)
    if (seeded === 0) return res.status(409).json({ error: 'no_empty_slots' })
    return res.json({ ok: true, created: seeded })
  }
}
