import { eq, and } from 'drizzle-orm'
import { db, kingdoms, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

// ── Universe constants ────────────────────────────────────────────────────────
const MAX_REALM  = 3
const MAX_REGION = 10
const MAX_SLOT   = 15

// ── Deterministic NPC generator (no DB, seeded by position) ──────────────────
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

function seededRand(seed) {
  // Simple LCG
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function generateNpc(realm, region, slot) {
  const seed = realm * 100000 + region * 1000 + slot
  const rand = seededRand(seed)
  const occupied = rand() > 0.35  // ~65% of slots have NPC kingdoms

  if (!occupied) return null

  const firstName = NPC_FIRST[Math.floor(rand() * NPC_FIRST.length)]
  const epithet   = rand() > 0.5 ? ` ${NPC_EPITHET[Math.floor(rand() * NPC_EPITHET.length)]}` : ''
  const points    = Math.floor(rand() * 50000)

  return {
    name:     `Reino de ${firstName}${epithet}`,
    username: `${firstName.toLowerCase()}${seed % 99}`,
    points,
    isNpc:    true,
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  // Parse & clamp params
  let realm  = Math.max(1, Math.min(MAX_REALM,  parseInt(req.query.realm  ?? '1', 10) || 1))
  let region = Math.max(1, Math.min(MAX_REGION, parseInt(req.query.region ?? '1', 10) || 1))

  // Get player's own kingdom for highlighting
  const [myKingdom] = await db
    .select({ id: kingdoms.id, realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot })
    .from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1)

  // Get all real kingdoms in this realm+region, joined with their owner's username
  const realKingdoms = await db
    .select({
      id:       kingdoms.id,
      slot:     kingdoms.slot,
      name:     kingdoms.name,
      username: users.username,
      userId:   kingdoms.userId,
    })
    .from(kingdoms)
    .innerJoin(users, eq(kingdoms.userId, users.id))
    .where(and(
      eq(kingdoms.realm,  realm),
      eq(kingdoms.region, region),
    ))

  // Build slots 1-15
  const realBySlot = Object.fromEntries(realKingdoms.map(k => [k.slot, k]))

  const slots = Array.from({ length: MAX_SLOT }, (_, i) => {
    const slot = i + 1

    if (realBySlot[slot]) {
      const k = realBySlot[slot]
      return {
        slot,
        kingdomId: k.id,
        name:      k.name,
        username:  k.username,
        isPlayer:  k.userId === userId,
        isNpc:     false,
        points:    0,
        isEmpty:   false,
      }
    }

    const npc = generateNpc(realm, region, slot)
    if (npc) {
      return { slot, kingdomId: null, ...npc, isPlayer: false, isEmpty: false }
    }

    return { slot, kingdomId: null, name: null, username: null, isPlayer: false, isNpc: false, points: 0, isEmpty: true }
  })

  return res.json({
    realm,
    region,
    maxRealm:  MAX_REALM,
    maxRegion: MAX_REGION,
    myPosition: myKingdom
      ? { realm: myKingdom.realm, region: myKingdom.region, slot: myKingdom.slot }
      : null,
    slots,
  })
}
