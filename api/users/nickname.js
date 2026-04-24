import { eq } from 'drizzle-orm'
import { db, users, kingdoms } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

const NICKNAME_RE = /^[a-zA-Z0-9_]{3,20}$/

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'unauthenticated' })

  const { nickname } = req.body
  if (!nickname || !NICKNAME_RE.test(nickname)) {
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

  // Update existing kingdom names if the user already has kingdoms (e.g. re-setting nickname)
  await db.update(kingdoms)
    .set({ name: `Reino de ${nickname}` })
    .where(eq(kingdoms.userId, userId))

  return res.json({ ok: true })
}
