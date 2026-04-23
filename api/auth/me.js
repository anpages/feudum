import { db, users } from '../_db.js'
import { eq } from 'drizzle-orm'
import { getSupabaseUser } from '../lib/supabase.js'

const COLS = { id: users.id, username: users.username, role: users.role, ether: users.ether, characterClass: users.characterClass }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const supabaseUser = await getSupabaseUser(req)
  if (!supabaseUser) return res.status(401).json({ error: 'No autenticado' })

  const [existing] = await db.select(COLS).from(users).where(eq(users.id, supabaseUser.id)).limit(1)
  if (existing) return res.json(existing)

  // First sign-in (or trigger never fired): create the public.users row from Supabase identity.
  const email     = supabaseUser.email ?? `${supabaseUser.id}@local`
  const avatarUrl = supabaseUser.user_metadata?.avatar_url ?? null
  await db.insert(users).values({ id: supabaseUser.id, email, avatarUrl }).onConflictDoNothing()

  const [created] = await db.select(COLS).from(users).where(eq(users.id, supabaseUser.id)).limit(1)
  return res.json(created)
}
