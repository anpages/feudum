import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearSessionCookie } from '../lib/handler'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  clearSessionCookie(res)
  return res.json({ ok: true })
}
