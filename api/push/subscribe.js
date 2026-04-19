/**
 * POST /api/push/subscribe   — save a push subscription
 * DELETE /api/push/subscribe — remove it
 */
import { eq } from 'drizzle-orm'
import { db, pushSubscriptions } from '../_db.js'
import { getSessionUserId } from '../lib/handler.js'

export default async function handler(req, res) {
  const userId = await getSessionUserId(req)
  if (!userId) return res.status(401).json({ error: 'No autenticado' })

  if (req.method === 'POST') {
    const { endpoint, keys, _delete } = req.body ?? {}

    if (_delete) {
      if (endpoint) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
      return res.json({ ok: true })
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth)
      return res.status(400).json({ error: 'Suscripción inválida' })

    await db.insert(pushSubscriptions).values({
      userId, endpoint, p256dh: keys.p256dh, auth: keys.auth,
    }).onConflictDoNothing()

    return res.json({ ok: true })
  }

  return res.status(405).end()
}
