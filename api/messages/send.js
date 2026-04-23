import { eq } from 'drizzle-orm'
import { db, messages, users } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  const { to: toUsername, subject, body } = req.body ?? {}
  if (!toUsername?.trim()) return res.status(400).json({ error: 'Destinatario requerido' })
  if (!subject?.trim())    return res.status(400).json({ error: 'Asunto requerido' })
  if (!body?.trim())       return res.status(400).json({ error: 'Mensaje requerido' })
  if (subject.length > 100) return res.status(400).json({ error: 'Asunto demasiado largo (máx. 100)' })
  if (body.length > 2000)   return res.status(400).json({ error: 'Mensaje demasiado largo (máx. 2000)' })

  const [[sender], [recipient]] = await Promise.all([
    db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ id: users.id, username: users.username })
      .from(users).where(eq(users.username, toUsername.trim())).limit(1),
  ])

  if (!recipient) return res.status(404).json({ error: 'Usuario no encontrado' })
  if (recipient.id === userId) return res.status(400).json({ error: 'No puedes enviarte un mensaje a ti mismo' })

  await db.insert(messages).values({
    userId:  recipient.id,
    senderId: userId,
    type:    'player',
    subject: subject.trim(),
    data:    { body: body.trim(), fromUsername: sender?.username ?? 'Desconocido' },
  })

  return res.json({ ok: true })
}
