import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { FeuduLogo } from '@/components/FeuduLogo'

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const oauthError = searchParams.get('error')
  const { signInWithGoogle } = useAuth()

  return (
    <div className="bg-login min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[340px] anim-fade-up">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8 gap-4">
          <FeuduLogo variant="icon" height={64} className="anim-float" />
          <FeuduLogo variant="full" height={34} />
          <p className="font-body text-ink-muted text-sm tracking-wide">
            Forja tu legado en piedra y sangre
          </p>
        </div>

        {/* Card */}
        <div className="card-medieval p-7 rounded">
          <div className="card-corner-tr" />
          <div className="card-corner-bl" />

          {oauthError && (
            <div className="mb-5 px-3 py-2.5 rounded-sm bg-crimson/5 border border-crimson/15">
              <p className="font-ui text-xs text-crimson leading-snug">
                No fue posible iniciar sesión con Google. Inténtalo de nuevo.
              </p>
            </div>
          )}

          <p className="font-ui text-[0.65rem] text-ink-muted/70 text-center mb-5 tracking-[0.18em] uppercase">
            Accede a tu reino
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded border border-gold/20 bg-parchment hover:bg-gold-soft active:scale-[0.99] transition-all duration-150 font-ui font-semibold text-ink-mid tracking-wide text-sm shadow-sm hover:shadow-md hover:border-gold/35"
          >
            <GoogleIcon />
            Continuar con Google
          </button>

          <div className="divider mt-6 mb-0">◆</div>
          <p className="text-center font-ui tracking-[0.18em] uppercase text-ink-muted/25 text-[0.55rem] mt-3 select-none">
            Feudum · Anno MMXXVI
          </p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
