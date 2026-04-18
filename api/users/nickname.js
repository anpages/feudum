import { eq } from 'drizzle-orm'
import { db, users, kingdoms, research } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

const NICKNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'unauthenticated' })

  const { nickname } = req.body
  console.log('[nickname] body:', req.body, 'nickname:', nickname)
  if (!nickname || !NICKNAME_RE.test(nickname)) {
    console.log('[nickname] invalid_nickname')
    return res.status(400).json({ error: 'invalid_nickname', message: '3–20 chars, letters/numbers/underscore only' })
  }

  const [current] = await db
    .select({ id: users.id, username: users.username })
    .from(users).where(eq(users.id, userId)).limit(1)

  if (!current) return res.status(404).json({ error: 'user_not_found' })
  if (current.username !== null) return res.status(409).json({ error: 'already_set' })

  const [conflict] = await db
    .select({ id: users.id })
    .from(users).where(eq(users.username, nickname)).limit(1)
  if (conflict) return res.status(409).json({ error: 'nickname_taken' })

  await db.update(users)
    .set({ username: nickname, updatedAt: new Date() })
    .where(eq(users.id, userId))

  const [existingKingdom] = await db
    .select({ id: kingdoms.id })
    .from(kingdoms).where(eq(kingdoms.userId, userId)).limit(1)

  if (existingKingdom) {
    await db.update(kingdoms)
      .set({ name: `Reino de ${nickname}` })
      .where(eq(kingdoms.userId, userId))
  } else {
    const taken = await db
      .select({ realm: kingdoms.realm, region: kingdoms.region, slot: kingdoms.slot })
      .from(kingdoms)
    const takenSet = new Set(taken.map(p => `${p.realm}:${p.region}:${p.slot}`))
    let position = null
    outer: for (let realm = 1; realm <= 5; realm++)
      for (let region = 1; region <= 10; region++)
        for (let slot = 1; slot <= 15; slot++)
          if (!takenSet.has(`${realm}:${region}:${slot}`)) { position = { realm, region, slot }; break outer }

    if (!position) return res.status(500).json({ error: 'no_slots' })

    await db.insert(kingdoms).values({
      userId,
      name:               `Reino de ${nickname}`,
      realm:              position.realm,
      region:             position.region,
      slot:               position.slot,
      lastResourceUpdate: Math.floor(Date.now() / 1000),
    })
    await db.insert(research).values({ userId })
  }

  return res.json({ ok: true })
}
