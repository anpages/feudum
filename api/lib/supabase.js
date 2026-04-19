import './env.js'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { createRemoteJWKSet, jwtVerify } from 'jose'

// JWKS verifier — cached at module level, reused across warm invocations
let _jwks = null
function getJWKS() {
  if (!_jwks) {
    const { url } = getEnv()
    _jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`))
  }
  return _jwks
}

function getEnv() {
  const url     = process.env.STORAGE_SUPABASE_URL
  const anon    = process.env.STORAGE_VITE_SUPABASE_ANON_KEY ?? process.env.STORAGE_SUPABASE_ANON_KEY
  const service = process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('STORAGE_SUPABASE_URL not set')
  return { url, anon, service }
}

// Admin client — service role, bypasses RLS
let _admin = null
export function getSupabaseAdmin() {
  if (!_admin) {
    const { url, service } = getEnv()
    _admin = createClient(url, service, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _admin
}

// Per-request server client — manages Supabase session cookies
export function createSupabaseClient(req, res) {
  const { url, anon } = getEnv()
  return createServerClient(url, anon, {
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

function extractAccessToken(req) {
  // Prefer Authorization header (localStorage-based auth)
  const authHeader = req.headers.authorization ?? req.headers.Authorization ?? ''
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7)

  // Fallback: parse Supabase session cookies
  const cookies = parseCookieHeader(req.headers.cookie ?? '')
  for (const { name, value } of cookies) {
    if (name.startsWith('sb-') && name.endsWith('-auth-token') && !name.includes('.')) {
      try { return JSON.parse(decodeURIComponent(value))?.access_token ?? null } catch {}
    }
  }
  const chunks = {}
  for (const { name, value } of cookies) {
    const m = name.match(/^(sb-.+-auth-token)\.(\d+)$/)
    if (m) chunks[parseInt(m[2])] = value
  }
  if (Object.keys(chunks).length > 0) {
    const joined = Object.keys(chunks).sort((a,b)=>a-b).map(k=>chunks[k]).join('')
    try { return JSON.parse(decodeURIComponent(joined))?.access_token ?? null } catch {}
  }
  return null
}

export async function getSupabaseUser(req) {
  const token = extractAccessToken(req)
  if (!token) return null

  // Fast path: verify JWT locally via JWKS (no network round-trip to Supabase Auth)
  try {
    const { payload } = await jwtVerify(token, getJWKS())
    if (payload.sub) return { id: payload.sub, email: payload.email, user_metadata: payload.user_metadata ?? {} }
  } catch {
    // Fall through to remote verification (handles key rotation, legacy tokens)
  }

  // Slow path: remote verification (first call until JWKS warms up, or on key rotation)
  const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
  if (error || !user) return null
  return user
}
