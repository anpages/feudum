import { eq, and, inArray } from 'drizzle-orm'
import { db, users, kingdoms } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
import { applyBuildingEffect } from '../lib/buildings.js'
import { UNIVERSE } from '../lib/config.js'

const NPC_FIRST = [
  'Aldric','Berthold','Cedric','Dorian','Edmund','Faolan','Gareth','Hadwin',
  'Ingram','Jarvis','Kelwin','Leofric','Maldred','Norbert','Oswin','Perkin',
  'Quillan','Radulf','Sigmund','Torben','Ulric','Valthor','Wendell','Xander',
  'Yorick','Zachary','Aelric','Baldric','Cormac','Drest',
]
const NPC_EPITHET = [
  'el Fuerte','el Sabio','el Oscuro','el Justo','el Temido','el Grande',
  'Puño de Hierro','Corazón de León','el Antiguo','el Intrépido',
]

function wangHash(n) {
  n = (n ^ 61) ^ (n >>> 16)
  n = Math.imul(n, 9)
  n = n ^ (n >>> 4)
  n = Math.imul(n, 0x27d4eb2d)
  n = n ^ (n >>> 15)
  return n >>> 0
}

function seededRand(seed) {
  let s = wangHash(seed)
  return () => { s = wangHash(s + 1); return s / 0x100000000 }
}

function slotNpcData(realm, region, slot) {
  const seed = realm * 374761397 + region * 1234567 + slot * 7654321
  const rand = seededRand(seed)
  if (rand() > 0.70) return null  // ~30% occupancy

  const firstName = NPC_FIRST[Math.floor(rand() * NPC_FIRST.length)]
  const epithet   = rand() > 0.5 ? ` ${NPC_EPITHET[Math.floor(rand() * NPC_EPITHET.length)]}` : ''
  const npcLevel  = 1 + Math.floor(rand() * 3)  // 1, 2 or 3
  return { name: `Reino de ${firstName}${epithet}`, npcLevel }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  const { action } = req.body
  if (action !== 'seed_npcs') return res.status(400).json({ error: 'unknown_action' })

  // ── Get or create NPC system user ─────────────────────────────────────────
  let [npcUser] = await db.select({ id: users.id })
    .from(users).where(eq(users.isNpc, true)).limit(1)

  if (!npcUser) {
    ;[npcUser] = await db.insert(users).values({
      email:  'npc@feudum.internal',
      isNpc:  true,
      isAdmin: false,
    }).returning({ id: users.id })
  }

  const npcUserId = npcUser.id

  // ── Delete all existing NPC kingdoms ──────────────────────────────────────
  const deleted = await db.delete(kingdoms)
    .where(eq(kingdoms.isNpc, true))
    .returning({ id: kingdoms.id })

  // ── Seed universe ─────────────────────────────────────────────────────────
  const { maxRealm, maxRegion, maxSlot } = UNIVERSE
  const now = Math.floor(Date.now() / 1000)
  let created = 0

  for (let realm = 1; realm <= maxRealm; realm++) {
    for (let region = 1; region <= maxRegion; region++) {
      // Skip slots already taken by real players in this region
      const realSlots = await db.select({ slot: kingdoms.slot })
        .from(kingdoms)
        .where(and(
          eq(kingdoms.realm, realm),
          eq(kingdoms.region, region),
          eq(kingdoms.isNpc, false),
        ))
      const takenSlots = new Set(realSlots.map(r => r.slot))

      const batch = []
      for (let slot = 1; slot <= maxSlot; slot++) {
        if (takenSlots.has(slot)) continue
        const npc = slotNpcData(realm, region, slot)
        if (!npc) continue
        batch.push({
          userId:   npcUserId,
          name:     npc.name,
          realm, region, slot,
          isNpc:    true,
          npcLevel: npc.npcLevel,
          wood: 0, stone: 0, grain: 0,
          woodCapacity: 10000, stoneCapacity: 10000, grainCapacity: 10000,
          woodProduction: 0, stoneProduction: 0, grainProduction: 0,
          populationMax: 0, populationUsed: 0,
          lastResourceUpdate: now,
        })
      }

      if (batch.length > 0) {
        await db.insert(kingdoms).values(batch)
        created += batch.length
      }
    }
  }

  return res.json({ ok: true, deleted: deleted.length, created, npcUserId })
}
