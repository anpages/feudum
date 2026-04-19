import { getSupabaseUser } from './supabase.js'

// Returns the user UUID from the Supabase session (== auth.users.id == public.users.id)
export async function getSessionUserId(req) {
  const supabaseUser = await getSupabaseUser(req)
  return supabaseUser?.id ?? null
}
