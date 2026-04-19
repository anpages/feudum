/**
 * Web Push helper — sends a notification to all subscriptions for a user.
 */
import webpush from 'web-push'
import { eq } from 'drizzle-orm'
import { db, pushSubscriptions } from '../_db.js'

let _configured = false
function ensureConfigured() {
  if (_configured) return
  const pub  = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return
  webpush.setVapidDetails('mailto:noreply@feudum.anpages.com', pub, priv)
  _configured = true
}

export async function sendPush(userId, payload) {
  ensureConfigured()
  if (!_configured) return

  const subs = await db.select().from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))

  const dead = []
  await Promise.allSettled(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.id)
    }
  }))

  if (dead.length > 0) {
    await Promise.all(dead.map(id =>
      db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id))
    ))
  }
}
