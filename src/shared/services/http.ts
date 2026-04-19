import { supabase } from '@/lib/supabase'

const BASE = '/api'

// Cache the token — updated reactively via auth state listener
let _token: string | null = null

supabase.auth.getSession().then(({ data: { session } }) => {
  _token = session?.access_token ?? null
})

supabase.auth.onAuthStateChange((_event, session) => {
  _token = session?.access_token ?? null
})

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  if (_token) headers.set('Authorization', `Bearer ${_token}`)

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
