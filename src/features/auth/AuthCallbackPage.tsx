import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    // Supabase puede devolver el error en la URL (?error=... o #error=...)
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const urlError = params.get('error') ?? hashParams.get('error')
    if (urlError) {
      navigate(`/login?error=${encodeURIComponent(urlError)}`, { replace: true })
      return
    }

    let subscription: { unsubscribe: () => void } | null = null
    let timeout: ReturnType<typeof setTimeout> | null = null

    const finish = (ok: boolean, reason?: string) => {
      timeout && clearTimeout(timeout)
      subscription?.unsubscribe()
      navigate(ok ? '/' : `/login?error=${reason ?? 'exchange_failed'}`, { replace: true })
    }

    timeout = setTimeout(() => finish(false, 'timeout'), 15_000)

    const code = params.get('code')
    if (code) {
      // Flujo PKCE: intercambiar el código explícitamente.
      // No depender de detectSessionInUrl — en SPAs ya inicializadas puede no dispararse.
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) { finish(false, 'exchange_failed'); return }
        if (data.session) { finish(true); return }
        finish(false, 'no_session')
      })
    } else {
      // Flujo implícito (hash) o sesión ya establecida en localStorage
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) { finish(false, 'session_error'); return }
        if (session) { finish(true); return }

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session) finish(true)
        })
        subscription = data.subscription
      })
    }

    return () => { timeout && clearTimeout(timeout); subscription?.unsubscribe() }
  }, [navigate])

  return (
    <div className="bg-login min-h-screen flex items-center justify-center">
      <p className="font-ui text-parchment-dim text-sm animate-pulse">Iniciando sesión…</p>
    </div>
  )
}
