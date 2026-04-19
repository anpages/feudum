import { db, users } from '../_db.js'
import { eq } from 'drizzle-orm'
import { getSupabaseUser } from '../lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabaseUser = await getSupabaseUser(req)
  if (!supabaseUser) return res.status(401).json({ error: 'No autenticado' })

  let [user] = await db
    .select({ id: users.id, username: users.username, isAdmin: users.isAdmin, ether: users.ether, characterClass: users.characterClass })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUser.id))
    .limit(1)

  // Lazy creation on first login
  if (!user) {
    const isAdminEmail = process.env.ADMIN_EMAIL && supabaseUser.email === process.env.ADMIN_EMAIL
    ;[user] = await db.insert(users).values({
      supabaseUserId: supabaseUser.id,
      email:     supabaseUser.email,
      avatarUrl: supabaseUser.user_metadata?.avatar_url,
      isAdmin:   !!isAdminEmail,
    }).returning({ id: users.id, username: users.username, isAdmin: users.isAdmin, ether: users.ether, characterClass: users.characterClass })
  }

  return res.json(user)
}
