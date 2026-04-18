import { eq, and } from 'drizzle-orm'
import { db, kingdoms, users, debrisFields } from '../_db.js'
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

// Wang hash — mixes bits thoroughly so nearby inputs diverge wildly
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
  return () => {
    s = wangHash(s + 1)
    return s / 0x100000000
  }
}

function generateNpc(realm, region, slot) {
  // Multiply by large primes so adjacent slots produce completely different seeds
  const seed = realm * 374761397 + region * 1234567 + slot * 7654321
  const rand = seededRand(seed)
  const occupied = rand() > 0.70  // ~30% of slots have NPC kingdoms

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

  // Get player's own kingdom for highlighting + debris for this region
  const [[myKingdom], debrisRows] = await Promise.all([
    db.select({ id: kingdoms.id, realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot })
      .from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1),
    db.select().from(debrisFields)
      .where(and(eq(debrisFields.realm, realm), eq(debrisFields.region, region))),
  ])
  const debrisBySlot = Object.fromEntries(debrisRows.map(d => [d.slot, { wood: d.wood, stone: d.stone }]))

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

    const debris = debrisBySlot[slot] ?? null

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
        debris,
      }
    }

    const npc = generateNpc(realm, region, slot)
    if (npc) {
      return { slot, kingdomId: null, ...npc, isPlayer: false, isEmpty: false, debris }
    }

    return { slot, kingdomId: null, name: null, username: null, isPlayer: false, isNpc: false, points: 0, isEmpty: true, debris }
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
