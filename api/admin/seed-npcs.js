import { eq } from 'drizzle-orm'
import { db, users, kingdoms, NPC_USER_ID } from '../_db.js'
import { getAdminUserId } from '../lib/admin.js'
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

function npcName(realm, region, slot) {
  const seed = realm * 374761397 + region * 1234567 + slot * 7654321
  const rand = seededRand(seed)
  rand() // consume first value (was used for occupancy check — skip)
  const firstName = NPC_FIRST[Math.floor(rand() * NPC_FIRST.length)]
  const epithet   = rand() > 0.5 ? ` ${NPC_EPITHET[Math.floor(rand() * NPC_EPITHET.length)]}` : ''
  return `Reino de ${firstName}${epithet}`
}

// Fisher-Yates shuffle in-place
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const adminId = await getAdminUserId(req)
  if (!adminId) return res.status(403).json({ error: 'forbidden' })

  const { action } = req.body
  if (!['seed_npcs', 'reset_npcs'].includes(action)) return res.status(400).json({ error: 'unknown_action' })

  // ── Get or create NPC system user (deterministic UUID) ────────────────────
  const [npcUser] = await db.select({ id: users.id })
    .from(users).where(eq(users.id, NPC_USER_ID)).limit(1)

  if (!npcUser) {
    await db.insert(users).values({
      id:      NPC_USER_ID,
      email:   'npc@feudum.local',
      isNpc:   true,
      isAdmin: false,
    })
  }
  const npcUserId = NPC_USER_ID

  // ── Reset: just delete all NPC kingdoms and return ────────────────────────
  if (action === 'reset_npcs') {
    const deleted = await db.delete(kingdoms)
      .where(eq(kingdoms.isNpc, true))
      .returning({ id: kingdoms.id })
    return res.json({ ok: true, deleted: deleted.length, created: 0 })
  }

  // ── Seed: add NPCs to existing ones ───────────────────────────────────────
  const level1 = Math.max(0, parseInt(req.body.level1 ?? 0, 10) || 0)
  const level2 = Math.max(0, parseInt(req.body.level2 ?? 0, 10) || 0)
  const level3 = Math.max(0, parseInt(req.body.level3 ?? 0, 10) || 0)
  const total  = level1 + level2 + level3

  if (total === 0)  return res.status(400).json({ error: 'total_must_be_positive' })
  if (total > 300)  return res.status(400).json({ error: 'max_300_npcs' })

  // ── Build list of available slots (not taken by any kingdom) ──────────────
  const { maxRealm, maxRegion, maxSlot } = UNIVERSE
  const takenRows = await db.select({ realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot })
    .from(kingdoms)
  const takenSet = new Set(takenRows.map(k => `${k.realm}:${k.region}:${k.slot}`))

  const available = []
  for (let realm = 1; realm <= maxRealm; realm++)
    for (let region = 1; region <= maxRegion; region++)
      for (let slot = 1; slot <= maxSlot; slot++)
        if (!takenSet.has(`${realm}:${region}:${slot}`))
          available.push({ realm, region, slot })

  if (available.length < total) {
    return res.status(400).json({ error: 'not_enough_slots', available: available.length, requested: total })
  }

  // ── Pick random slots and assign levels ───────────────────────────────────
  shuffle(available)
  const chosen = available.slice(0, total)

  const levels = [
    ...Array(level1).fill(1),
    ...Array(level2).fill(2),
    ...Array(level3).fill(3),
  ]
  shuffle(levels)

  const now = Math.floor(Date.now() / 1000)
  const batch = chosen.map(({ realm, region, slot }, i) => ({
    userId:             npcUserId,
    name:               npcName(realm, region, slot),
    realm, region, slot,
    tempAvg:            240 - (slot - 1) * 25,
    isNpc:              true,
    npcLevel:           levels[i],
    wood:               levels[i] >= 3 ? 5000 : levels[i] === 2 ? 3000 : 2000,
    stone:              levels[i] >= 3 ? 2500 : levels[i] === 2 ? 1500 : 1000,
    grain:              500,
    woodCapacity:       10000,
    stoneCapacity:      10000,
    grainCapacity:      10000,
    woodProduction:     0,
    stoneProduction:    0,
    grainProduction:    0,
    lastResourceUpdate: now,
  }))

  for (let i = 0; i < batch.length; i += 50) {
    await db.insert(kingdoms).values(batch.slice(i, i + 50))
  }

  const byLevel = { 1: level1, 2: level2, 3: level3 }
  return res.json({ ok: true, deleted: 0, created: total, byLevel, npcUserId })
}
