import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    // Supabase auto-exchanges the PKCE code via detectSessionInUrl on client init.
    // We just wait for the session to be ready.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { navigate('/', { replace: true }); return }

      // Not ready yet — wait for the auth state change event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          subscription.unsubscribe()
          navigate('/', { replace: true })
        } else if (event === 'SIGNED_OUT') {
          subscription.unsubscribe()
          navigate('/login?error=exchange_failed', { replace: true })
        }
      })
    })
  }, [navigate])

  return (
    <div className="bg-login min-h-screen flex items-center justify-center">
      <p className="font-ui text-parchment-dim text-sm animate-pulse">Iniciando sesión…</p>
    </div>
  )
}
