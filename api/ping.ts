import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({
    ok: true,
    db: !!process.env.DATABASE_URL,
    secret: !!process.env.BETTER_AUTH_SECRET,
    gid: !!process.env.GOOGLE_CLIENT_ID,
    gsecret: !!process.env.GOOGLE_CLIENT_SECRET,
  })
}
