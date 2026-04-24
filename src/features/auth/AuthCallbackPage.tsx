import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    let subscription: { unsubscribe: () => void } | null = null
    let timeout: ReturnType<typeof setTimeout> | null = null

    const finish = (ok: boolean) => {
      timeout && clearTimeout(timeout)
      subscription?.unsubscribe()
      navigate(ok ? '/' : '/login?error=exchange_failed', { replace: true })
    }

    // Timeout: si en 15s no hay sesión redirige al login con error
    timeout = setTimeout(() => finish(false), 15_000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { finish(true); return }

      // Sesión no lista aún — esperar cualquier evento con sesión válida
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) { finish(true); return }
        if (event === 'SIGNED_OUT') finish(false)
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
