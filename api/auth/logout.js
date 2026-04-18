import { clearSessionCookie } from '../lib/handler.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  clearSessionCookie(res)
  return res.json({ ok: true })
}
