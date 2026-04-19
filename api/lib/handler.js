import { eq } from 'drizzle-orm'
import { db, users } from '../_db.js'
import { getSupabaseUser } from './supabase.js'

// Returns the internal integer user ID from the Supabase session cookie
export async function getSessionUserId(req) {
  const supabaseUser = await getSupabaseUser(req)
  if (!supabaseUser) return null

  const [user] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUser.id))
    .limit(1)

  return user?.id ?? null
}

// No-ops — Supabase manages session cookies automatically
export function setSessionCookie() {}
export function clearSessionCookie() {}
