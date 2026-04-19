import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) { navigate('/login?error=no_code', { replace: true }); return }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) navigate('/login?error=exchange_failed', { replace: true })
      else navigate('/?next=overview', { replace: true })
    })
  }, [navigate])

  return (
    <div className="bg-login min-h-screen flex items-center justify-center">
      <p className="font-ui text-parchment-dim text-sm animate-pulse">Iniciando sesión…</p>
    </div>
  )
}
