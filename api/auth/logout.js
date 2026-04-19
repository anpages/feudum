import { createSupabaseClient } from '../lib/supabase.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const supabase = createSupabaseClient(req, res)
  await supabase.auth.signOut()
  return res.json({ ok: true })
}
