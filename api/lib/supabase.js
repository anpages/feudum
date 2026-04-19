import { createClient } from '@supabase/supabase-js'
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

const SUPABASE_URL         = process.env.STORAGE_SUPABASE_URL
const SUPABASE_ANON_KEY    = process.env.STORAGE_VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY

// Admin client — service role, bypasses RLS, for server-side mutations
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Per-request server client — manages Supabase session cookies
export function createSupabaseClient(req, res) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(req.headers.cookie ?? '')
      },
      setAll(cookiesToSet) {
        const existing = [].concat(res.getHeader('Set-Cookie') ?? [])
        const newCookies = cookiesToSet.map(({ name, value, options }) =>
          serializeCookieHeader(name, value, options)
        )
        res.setHeader('Set-Cookie', [...existing, ...newCookies])
      },
    },
  })
}

// Extracts the Supabase access token from cookies without session refresh
function extractAccessToken(req) {
  const cookies = parseCookieHeader(req.headers.cookie ?? '')
  // Supabase stores the session as JSON in sb-*-auth-token or chunked sb-*-auth-token.0
  for (const { name, value } of cookies) {
    if (name.startsWith('sb-') && name.endsWith('-auth-token') && !name.includes('.')) {
      try {
        const session = JSON.parse(decodeURIComponent(value))
        return session?.access_token ?? null
      } catch { /* chunked cookie, handled below */ }
    }
  }
  // Chunked: reassemble sb-*-auth-token.0, .1, ...
  const chunks = {}
  for (const { name, value } of cookies) {
    const m = name.match(/^(sb-.+-auth-token)\.(\d+)$/)
    if (m) chunks[parseInt(m[2])] = value
  }
  if (Object.keys(chunks).length > 0) {
    const joined = Object.keys(chunks).sort((a,b)=>a-b).map(k=>chunks[k]).join('')
    try {
      const session = JSON.parse(decodeURIComponent(joined))
      return session?.access_token ?? null
    } catch {}
  }
  return null
}

// Returns the authenticated Supabase user or null — works without res (no refresh)
export async function getSupabaseUser(req) {
  const token = extractAccessToken(req)
  if (!token) return null
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return null
  return user
}

// Sets session cookies — use after sign-in/sign-out
export async function handleAuthCallback(req, res) {
  const supabase = createSupabaseClient(req, res)
  const { data, error } = await supabase.auth.getSession()
  return { session: data.session, error }
}
