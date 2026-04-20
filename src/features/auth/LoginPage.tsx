import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { FeuduLogo } from '@/components/FeuduLogo'
import { Castle, FlaskConical, Swords, Map, UserPlus, Globe, Trophy } from 'lucide-react'

const FEATURES = [
  {
    Icon: Castle,
    title: 'Construye tu reino',
    desc: 'Levanta aserraderos, canteras y granjas. Amplía tu capacidad productiva con talleres, gremios y catedrales que multiplican cada recurso.',
  },
  {
    Icon: FlaskConical,
    title: 'Investiga tecnologías',
    desc: 'Desbloquea mejoras de combate, logística y magia en tu academia. Cada nivel puede inclinar la balanza en el campo de batalla.',
  },
  {
    Icon: Swords,
    title: 'Conquista el mapa',
    desc: 'Entrena escuderos, caballeros y paladines. Ataca reinos rivales, espía sus defensas y saquea sus recursos para financiar tu expansión.',
  },
  {
    Icon: Map,
    title: 'Expande tu dominio',
    desc: 'Coloniza territorios en el universo. Gestiona múltiples reinos simultáneamente y coordina tus ejércitos a través del mapa.',
  },
]

const STEPS = [
  {
    Icon: UserPlus,
    num: '01',
    title: 'Crea tu cuenta',
    desc: 'Entra con Google en segundos. Sin formularios, sin esperas. Tu reino se genera automáticamente en el universo.',
  },
  {
    Icon: Globe,
    num: '02',
    title: 'Construye y crece',
    desc: 'Extrae recursos, levanta edificios e investiga tecnologías. El universo avanza en tiempo real aunque no estés conectado.',
  },
  {
    Icon: Trophy,
    num: '03',
    title: 'Compite y conquista',
    desc: 'Ataca reinos rivales, asciende en el ranking y lidera la temporada. El objetivo final: derrotar al Jefe Dragón y reclamar el trono.',
  },
]

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const oauthError = searchParams.get('error')
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen bg-game text-parchment">

      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-gold/10 glass px-5 sm:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FeuduLogo variant="icon" height={26} className="shrink-0" />
          <span className="font-display text-sm text-gold-dim tracking-[0.18em] uppercase">Feudum</span>
        </div>
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-2 px-4 py-1.5 rounded border border-gold/25 bg-parchment hover:bg-gold-soft active:scale-[0.98] transition-all duration-150 font-ui font-semibold text-ink-mid text-xs tracking-wide shadow-sm"
        >
          <GoogleIcon />
          Jugar gratis
        </button>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 sm:py-32">
        <div className="flex items-center gap-3 mb-6">
          <FeuduLogo variant="icon" height={52} className="anim-float" />
        </div>

        <p className="font-ui text-[0.6rem] text-gold/50 tracking-[0.3em] uppercase mb-3">
          Anno MMXXVI · Estrategia medieval multijugador
        </p>

        <h1 className="font-display text-5xl sm:text-6xl text-gold-light tracking-[0.14em] uppercase leading-none mb-5">
          Feudum
        </h1>

        <p className="font-body text-parchment text-lg sm:text-xl max-w-xl leading-relaxed mb-2">
          Un reino te espera. Construye, investiga y conquista en un universo
          compartido con miles de jugadores — gratis, sin trampa.
        </p>
        <p className="font-body text-parchment text-sm sm:text-base max-w-lg leading-relaxed mb-10">
          Inspirado en los grandes juegos de estrategia por navegador,
          reinterpretado con mecánicas modernas para 2026.
        </p>

        {oauthError && (
          <div className="mb-5 px-4 py-3 rounded border border-crimson/20 bg-crimson/5 max-w-sm w-full text-center">
            <p className="font-ui text-xs text-crimson">
              No fue posible iniciar sesión con Google. Inténtalo de nuevo.
            </p>
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-3 px-7 py-3.5 rounded border border-gold/30 bg-parchment hover:bg-gold-soft active:scale-[0.98] transition-all duration-150 font-ui font-bold text-ink-mid tracking-wide text-sm shadow-md hover:shadow-lg hover:border-gold/50 mb-3"
        >
          <GoogleIcon size={18} />
          Jugar gratis con Google
        </button>

        <p className="font-ui text-[0.58rem] text-parchment-dim/70 tracking-[0.18em] uppercase">
          Sin tarjeta de crédito · Sin microtransacciones
        </p>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="border-t border-gold/10 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-ui text-[0.6rem] text-gold/55 tracking-[0.28em] uppercase mb-3">Mecánicas de juego</p>
            <h2 className="font-display text-3xl sm:text-4xl text-parchment tracking-[0.1em] uppercase">
              Todo en un universo vivo
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="glass border border-gold/10 rounded p-6 flex flex-col gap-3 hover:border-gold/20 transition-colors duration-200">
                <div className="w-9 h-9 rounded flex items-center justify-center border border-gold/15 bg-gold/5">
                  <Icon size={16} className="text-gold" />
                </div>
                <h3 className="font-ui text-sm font-semibold text-parchment tracking-wide">{title}</h3>
                <p className="font-body text-sm text-parchment-dim leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="border-t border-gold/10 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-ui text-[0.6rem] text-gold/55 tracking-[0.28em] uppercase mb-3">Cómo funciona</p>
            <h2 className="font-display text-3xl sm:text-4xl text-parchment tracking-[0.1em] uppercase">
              Empieza en 3 pasos
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map(({ Icon, num, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center sm:items-start sm:text-left gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-display text-3xl text-gold/20 leading-none">{num}</span>
                  <div className="w-8 h-8 rounded-full border border-gold/20 flex items-center justify-center">
                    <Icon size={14} className="text-gold" />
                  </div>
                </div>
                <div>
                  <h3 className="font-ui text-sm font-semibold text-parchment tracking-wide mb-2">{title}</h3>
                  <p className="font-body text-sm text-parchment-dim leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="border-t border-gold/10 py-20 px-6 text-center">
        <div className="max-w-lg mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl text-gold-light tracking-[0.12em] uppercase mb-4">
            ¿Listo para gobernar?
          </h2>
          <p className="font-body text-parchment text-base mb-8 leading-relaxed">
            Miles de reinos ya luchan por el dominio del universo. El tuyo te espera.
          </p>
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-3 px-7 py-3.5 rounded border border-gold/30 bg-parchment hover:bg-gold-soft active:scale-[0.98] transition-all duration-150 font-ui font-bold text-ink-mid tracking-wide text-sm shadow-md hover:shadow-lg hover:border-gold/50"
          >
            <GoogleIcon size={18} />
            Jugar gratis con Google
          </button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gold/8 py-6 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FeuduLogo variant="icon" height={20} className="opacity-40" />
            <span className="font-ui text-[0.58rem] text-parchment-dim/30 tracking-[0.18em] uppercase">
              Feudum · Anno MMXXVI
            </span>
          </div>
          <p className="font-ui text-[0.52rem] text-parchment-dim/25 tracking-[0.1em] text-center">
            Inspirado en{' '}
            <a
              href="https://github.com/lanedirt/OGameX"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-parchment-dim/50 transition-colors underline underline-offset-2"
            >
              OGameX
            </a>
            {' '}(GPL) · Reimplementado con visión medieval y moderna para 2026
          </p>
        </div>
      </footer>

    </div>
  )
}

function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
