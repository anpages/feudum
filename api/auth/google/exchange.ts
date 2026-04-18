import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db, users } from '../../../db'
import { signToken } from '../../lib/jwt'
import { setSessionCookie } from '../../lib/handler'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const code        = req.query.code as string
  const redirectUri = req.query.redirectUri as string
  if (!code || !redirectUri) return res.status(400).json({ error: 'missing_params' })

  console.log('[oauth] exchanging code for token...')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })

  console.log('[oauth] token status:', tokenRes.status)
  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error('[oauth] token exchange failed:', body)
    return res.status(400).json({ error: 'token_exchange' })
  }

  const { access_token } = await tokenRes.json() as { access_token: string }

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })

  if (!profileRes.ok) return res.status(400).json({ error: 'profile_fetch' })

  const profile = await profileRes.json() as {
    sub: string; email: string; name: string; picture?: string
  }
  console.log('[oauth] profile:', profile.email)

  let [user] = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users).where(eq(users.googleId, profile.sub)).limit(1)

  let isNew = false

  if (!user) {
    isNew = true
    const [newUser] = await db.insert(users).values({
      email:     profile.email,
      googleId:  profile.sub,
      avatarUrl: profile.picture,
    }).returning({ id: users.id, username: users.username, email: users.email })
    user = newUser
  }

  const token = await signToken(user.id)
  setSessionCookie(res, token)

  console.log('[oauth] login complete, user:', user.id, isNew ? '(new)' : '')
  return res.json({ id: user.id, username: user.username, email: user.email, needsNickname: isNew })
}
