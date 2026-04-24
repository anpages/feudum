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

    // The Supabase client (detectSessionInUrl: true) auto-exchanges the PKCE
    // code from the URL. We must NOT call exchangeCodeForSession ourselves —
    // the code can only be used once and would fail with "invalid_grant".
    // Just wait: getSession() catches a fast exchange; onAuthStateChange catches
    // a slow one. Both paths call finish(true) and navigate to /.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { finish(false, 'session_error'); return }
      if (session) { finish(true); return }

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) finish(true)
      })
      subscription = data.subscription
    })

    return () => { timeout && clearTimeout(timeout); subscription?.unsubscribe() }
  }, [navigate])

  return (
    <div className="bg-login min-h-screen flex items-center justify-center">
      <p className="font-ui text-parchment-dim text-sm animate-pulse">Iniciando sesión…</p>
    </div>
  )
}
