import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/lib/auth'

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const qc             = useQueryClient()
  const ran            = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code  = searchParams.get('code')
    const error = searchParams.get('error')

    if (error || !code) {
      navigate('/login?error=oauth_cancelled', { replace: true })
      return
    }

    authApi.exchangeCode(code)
      .then((user) => {
        qc.setQueryData(['auth', 'me'], user)
        navigate(user.needsNickname ? '/onboarding' : '/overview', { replace: true })
      })
      .catch(() => navigate('/login?error=exchange_failed', { replace: true }))
  }, [])

  return (
    <div className="bg-parchment min-h-screen flex items-center justify-center">
      <p className="font-ui text-ink-muted/50 tracking-widest uppercase text-sm animate-pulse">
        Accediendo al reino…
      </p>
    </div>
  )
}
