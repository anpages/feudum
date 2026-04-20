import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { FeuduLogo } from '@/components/FeuduLogo'
import { Castle, FlaskConical, Swords, Map } from 'lucide-react'

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const oauthError = searchParams.get('error')
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen bg-game flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center text-center px-6 pt-16 pb-10 flex-1">
        <FeuduLogo variant="icon" height={64} className="mb-6 anim-float" />

        <h1 className="font-display text-4xl sm:text-5xl text-gold-light tracking-[0.18em] uppercase leading-none mb-3">
          Feudum
        </h1>
        <p className="font-ui text-[0.6rem] text-gold-dim/50 tracking-[0.22em] uppercase mb-6">
          Anno MMXXVI
        </p>

        <p className="font-body text-parchment-dim text-base sm:text-lg max-w-lg leading-relaxed mb-2">
          Un juego de estrategia medieval multijugador por navegador.
        </p>
        <p className="font-body text-parchment-dim/60 text-sm max-w-md leading-relaxed">
          Construye tu reino, investiga nuevas tecnologías, entrena ejércitos
          y compite contra otros jugadores en un universo en tiempo real.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-8 mb-10">
          {[
            { Icon: Castle,        label: 'Construye' },
            { Icon: FlaskConical,  label: 'Investiga' },
            { Icon: Swords,        label: 'Conquista' },
            { Icon: Map,           label: 'Explora'   },
          ].map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-gold/10">
              <Icon size={13} className="text-gold" />
              <span className="font-ui text-xs text-parchment-dim tracking-wider uppercase">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Login card ──────────────────────────────────────────────────── */}
        <div className="w-full max-w-[320px]">
          <div className="card-medieval p-6 rounded">
            <div className="card-corner-tr" />
            <div className="card-corner-bl" />

            {oauthError && (
              <div className="mb-4 px-3 py-2.5 rounded-sm bg-crimson/5 border border-crimson/15">
                <p className="font-ui text-xs text-crimson leading-snug">
                  No fue posible iniciar sesión con Google. Inténtalo de nuevo.
                </p>
              </div>
            )}

            <p className="font-ui text-[0.6rem] text-parchment-dim/50 text-center mb-4 tracking-[0.2em] uppercase">
              Accede a tu reino
            </p>

            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded border border-gold/20 bg-parchment hover:bg-gold-soft active:scale-[0.99] transition-all duration-150 font-ui font-semibold text-ink-mid tracking-wide text-sm shadow-sm hover:shadow-md hover:border-gold/35"
            >
              <GoogleIcon />
              Continuar con Google
            </button>

            <div className="divider mt-5 mb-0">◆</div>
            <p className="text-center font-ui tracking-[0.18em] uppercase text-parchment-dim/20 text-[0.5rem] mt-3 select-none">
              Feudum · Anno MMXXVI
            </p>
          </div>
        </div>
      </div>

      {/* ── Feature cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-gold/8">
        {FEATURES.map(({ Icon, title, desc }, i) => (
          <div
            key={title}
            className={`p-5 sm:p-6 flex flex-col gap-2 ${i < 3 ? 'border-r border-gold/8' : ''} ${i < 2 ? 'border-b border-gold/8 sm:border-b-0' : ''}`}
          >
            <Icon size={16} className="text-gold mb-1" />
            <span className="font-ui text-xs font-semibold text-parchment tracking-wide uppercase">{title}</span>
            <p className="font-body text-[0.7rem] text-parchment-dim/60 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

    </div>
  )
}

const FEATURES = [
  {
    Icon: Castle,
    title: 'Construye',
    desc: 'Levanta aserraderos, canteras y granjas. Amplía tu capacidad de almacenamiento y acelera la producción con talleres y gremios.',
  },
  {
    Icon: FlaskConical,
    title: 'Investiga',
    desc: 'Desbloquea tecnologías de combate, logística y magia en tu academia. Cada nivel marca la diferencia en el campo de batalla.',
  },
  {
    Icon: Swords,
    title: 'Conquista',
    desc: 'Entrena escuderos, caballeros y paladines. Lanza misiones de ataque, espionaje y pillaje contra reinos rivales.',
  },
  {
    Icon: Map,
    title: 'Explora',
    desc: 'Coloniza nuevos territorios en el mapa del universo. Gestiona múltiples reinos y coordina tus ejércitos a través del mapa.',
  },
]

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
