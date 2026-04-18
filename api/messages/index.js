import { eq, desc } from 'drizzle-orm'
import { db, messages } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

export default async function handler(req, res) {
  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  if (req.method === 'GET') {
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.userId, userId))
      .orderBy(desc(messages.createdAt))
      .limit(100)

    return res.json({
      messages: msgs.map(m => ({
        id:        m.id,
        type:      m.type,
        subject:   m.subject,
        data:      JSON.parse(m.data),
        viewed:    m.viewed,
        createdAt: m.createdAt,
      })),
    })
  }

  if (req.method === 'PATCH') {
    // Mark all as read
    await db
      .update(messages)
      .set({ viewed: true })
      .where(eq(messages.userId, userId))
    return res.json({ ok: true })
  }

  return res.status(405).end()
}
