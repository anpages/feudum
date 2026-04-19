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

  // public.users row is auto-created by the on_auth_user_created trigger.
  const [user] = await db
    .select({ id: users.id, username: users.username, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, supabaseUser.id))
    .limit(1)

  if (user && isAdminEmail && !user.isAdmin) {
    await db.update(users).set({ isAdmin: true, updatedAt: new Date() }).where(eq(users.id, user.id))
  }

  const isNew = !user?.username
  console.log('[oauth] login ok, user:', supabaseUser.id, isNew ? '(new)' : '')
  res.redirect(isNew ? '/?next=onboarding' : '/?next=overview')
}
