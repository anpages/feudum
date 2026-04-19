import { eq } from 'drizzle-orm'
import { db, users } from '../../_db.js'
import { createSupabaseClient } from '../../lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { code, error } = req.query
  if (error || !code) return res.redirect('/?error=oauth_cancelled')

  // Exchange code for session — Supabase sets session cookies automatically
  const supabase = createSupabaseClient(req, res)
  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !data?.user) {
    console.error('[oauth] exchange failed:', exchangeError?.message)
    return res.redirect('/?error=exchange_failed')
  }

  const supabaseUser = data.user
  const isAdminEmail = process.env.ADMIN_EMAIL && supabaseUser.email === process.env.ADMIN_EMAIL

  // Find or create internal user row
  let [user] = await db
    .select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUser.id))
    .limit(1)

  let isNew = false
  if (!user) {
    isNew = true
    const [newUser] = await db.insert(users).values({
      supabaseUserId: supabaseUser.id,
      email:     supabaseUser.email,
      avatarUrl: supabaseUser.user_metadata?.avatar_url,
      isAdmin:   !!isAdminEmail,
    }).returning({ id: users.id, username: users.username, isAdmin: users.isAdmin })
    user = newUser
  } else if (isAdminEmail && !user.isAdmin) {
    await db.update(users).set({ isAdmin: true, updatedAt: new Date() }).where(eq(users.id, user.id))
  }

  console.log('[oauth] login ok, user:', user.id, isNew ? '(new)' : '')
  res.redirect(isNew || !user.username ? '/?next=onboarding' : '/?next=overview')
}
