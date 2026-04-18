import { eq } from 'drizzle-orm'
import { db, users } from '../../_db.js'
import { signToken } from '../../lib/jwt.js'
import { setSessionCookie } from '../../lib/handler.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { code, error } = req.query
  if (error || !code) return res.redirect('/?error=oauth_cancelled')

  const redirectUri = `${req.headers['x-forwarded-proto'] ?? 'http'}://${req.headers.host}/api/auth/google/callback`

  console.log('[oauth] exchanging code...')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    console.error('[oauth] token exchange failed:', await tokenRes.text())
    return res.redirect('/?error=exchange_failed')
  }

  const { access_token } = await tokenRes.json()

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!profileRes.ok) return res.redirect('/?error=profile_failed')

  const profile = await profileRes.json()
  console.log('[oauth] profile:', profile.email)

  let [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users).where(eq(users.googleId, profile.sub)).limit(1)

  let isNew = false
  if (!user) {
    isNew = true
    const [newUser] = await db.insert(users).values({
      email:     profile.email,
      googleId:  profile.sub,
      avatarUrl: profile.picture,
    }).returning({ id: users.id, username: users.username })
    user = newUser
  }

  const token = await signToken(user.id)
  setSessionCookie(res, token)

  console.log('[oauth] login ok, user:', user.id, isNew ? '(new)' : '')
  res.redirect(isNew || !user.username ? '/?next=onboarding' : '/?next=overview')
}
