import { supabase } from '@/lib/supabase'

const BASE = '/api'

// Read the session per-request instead of caching the token at module load.
// Caching raced with React Query: the very first /api/auth/me could fire
// before supabase.auth.getSession() resolved → no Authorization header → 401.
// getSession() is in-memory (synchronous-ish) once Supabase has hydrated, so
// the cost is negligible and the token is always fresh (handles refresh too).
async function authHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? `Bearer ${session.access_token}` : null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  const auth = await authHeader()
  if (auth) headers.set('Authorization', auth)

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
