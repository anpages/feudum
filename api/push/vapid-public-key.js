/**
 * GET /api/push/vapid-public-key — returns the public VAPID key for the client.
 */
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) return res.status(503).json({ error: 'Push no configurado' })
  return res.json({ publicKey: key })
}
