import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { FeuduLogo } from '@/components/FeuduLogo'
import { Castle, FlaskConical, Swords, Map } from 'lucide-react'

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
    desc: 'Coloniza nuevos territorios en el universo. Gestiona múltiples reinos y coordina tus ejércitos a través del mapa.',
  },
]

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const oauthError = searchParams.get('error')
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen bg-game flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center text-center px-6 pt-16 pb-10 flex-1">

        <FeuduLogo variant="icon" height={60} className="mb-6 anim-float" />

        <p className="font-ui text-[0.58rem] text-gold-dim/60 tracking-[0.28em] uppercase mb-2">
          Anno MMXXVI
        </p>
        <h1 className="font-display text-4xl sm:text-5xl text-gold-light tracking-[0.18em] uppercase leading-none mb-3">
          Feudum
        </h1>
        <p className="font-ui text-[0.65rem] text-parchment-dim/60 tracking-[0.2em] uppercase mb-8">
          Estrategia medieval multijugador · Navegador · Tiempo real
        </p>

        <p className="font-body text-parchment-dim text-base sm:text-lg max-w-lg leading-relaxed mb-2">
          Construye un reino desde cero, investiga tecnologías, entrena ejércitos y
          compite contra jugadores reales en un universo que nunca se detiene.
        </p>
        <p className="font-body text-parchment-dim/70 text-sm max-w-md leading-relaxed mb-10">
          Inspirado en los grandes juegos de estrategia por navegador de los 2000,
          reinterpretado con una visión medieval y moderna.
        </p>

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
              Gratis · Sin microtransacciones
            </p>
          </div>
        </div>
      </div>

      {/* ── What is it ──────────────────────────────────────────────────── */}
      <div className="border-t border-gold/10 py-12 px-6">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center sm:text-left">
          <div>
            <p className="font-ui text-[0.6rem] text-gold/60 tracking-[0.22em] uppercase mb-2">¿Qué es?</p>
            <p className="font-body text-sm text-parchment-dim/80 leading-relaxed">
              Un juego de estrategia por navegador de gestión de recursos, construcción y conquista en un universo compartido con otros jugadores.
            </p>
          </div>
          <div>
            <p className="font-ui text-[0.6rem] text-gold/60 tracking-[0.22em] uppercase mb-2">¿Cómo se juega?</p>
            <p className="font-body text-sm text-parchment-dim/80 leading-relaxed">
              Construyes, investigas y entrenas tropas mientras gestionas recursos en tiempo real. Las acciones tienen consecuencias aunque estés desconectado.
            </p>
          </div>
          <div>
            <p className="font-ui text-[0.6rem] text-gold/60 tracking-[0.22em] uppercase mb-2">¿Por qué Feudum?</p>
            <p className="font-body text-sm text-parchment-dim/80 leading-relaxed">
              Sin anuncios, sin pay-to-win. Estrategia pura inspirada en los clásicos del género, con mecánicas actualizadas para 2026.
            </p>
          </div>
        </div>
      </div>

      {/* ── Feature cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-gold/8">
        {FEATURES.map(({ Icon, title, desc }, i) => (
          <div
            key={title}
            className={`p-5 sm:p-6 flex flex-col gap-2
              ${i < 3 ? 'border-r border-gold/8' : ''}
              ${i < 2 ? 'border-b border-gold/8 sm:border-b-0' : ''}`}
          >
            <Icon size={16} className="text-gold mb-1" />
            <span className="font-ui text-xs font-semibold text-parchment tracking-wide uppercase">{title}</span>
            <p className="font-body text-[0.7rem] text-parchment-dim/70 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── Credits ───────────────────────────────────────────────────────── */}
      <div className="border-t border-gold/8 py-4 px-6 text-center">
        <p className="font-ui text-[0.5rem] text-parchment-dim/25 tracking-[0.12em]">
          Inspirado en{' '}
          <a
            href="https://github.com/lanedirt/OGameX"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-parchment-dim/50 transition-colors underline underline-offset-2"
          >
            OGameX
          </a>
          {' '}(GPL) · Reimplementado con visión medieval y moderna
        </p>
      </div>

    </div>
  )
}

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
