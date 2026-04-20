import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { FeuduLogo } from '@/components/FeuduLogo'
import { Castle, FlaskConical, Swords, Map, UserPlus, Globe, Trophy } from 'lucide-react'

const FEATURES = [
  {
    Icon: Castle,
    title: 'Construye tu reino',
    desc: 'Levanta aserraderos, canteras y granjas. Amplía tu capacidad productiva con talleres, gremios y catedrales.',
  },
  {
    Icon: FlaskConical,
    title: 'Investiga tecnologías',
    desc: 'Desbloquea mejoras de combate, logística y magia en tu academia. Cada nivel marca la diferencia en batalla.',
  },
  {
    Icon: Swords,
    title: 'Conquista el mapa',
    desc: 'Entrena escuderos, caballeros y paladines. Ataca reinos rivales y saquea sus recursos.',
  },
  {
    Icon: Map,
    title: 'Expande tu dominio',
    desc: 'Coloniza territorios en el universo. Gestiona múltiples reinos y coordina tus ejércitos.',
  },
]

const STEPS = [
  {
    Icon: UserPlus,
    num: '01',
    title: 'Crea tu cuenta',
    desc: 'Entra con Google en segundos. Tu reino se genera automáticamente en el universo.',
  },
  {
    Icon: Globe,
    num: '02',
    title: 'Construye y crece',
    desc: 'Extrae recursos, levanta edificios e investiga tecnologías. El universo avanza en tiempo real.',
  },
  {
    Icon: Trophy,
    num: '03',
    title: 'Compite y conquista',
    desc: 'Asciende en el ranking y lidera la temporada. El objetivo: derrotar al Jefe Dragón y reclamar el trono.',
  },
]

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const oauthError = searchParams.get('error')
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen" style={{ background: '#faf6ef', color: '#1c1208' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 sm:py-32"
        style={{ background: 'linear-gradient(180deg, #faf6ef 0%, #f4ead8 100%)' }}>

        <div className="mb-6 anim-float">
          <FeuduLogo variant="icon" height={64} />
        </div>

        <p className="font-ui text-[0.6rem] tracking-[0.3em] uppercase mb-3" style={{ color: '#8a6e1a' }}>
          Anno MMXXVI · Estrategia medieval multijugador
        </p>

        <h1 className="font-display text-5xl sm:text-6xl tracking-[0.14em] uppercase leading-none mb-5"
          style={{ color: '#b8860b' }}>
          Feudum
        </h1>

        <p className="font-body text-sm sm:text-base max-w-xl leading-relaxed mb-2" style={{ color: '#1c1208' }}>
          Un reino te espera. Construye, investiga y conquista en un universo
          compartido con miles de jugadores — gratis, sin trampa.
        </p>
        <p className="font-body text-sm max-w-lg leading-relaxed mb-10" style={{ color: '#4a3820' }}>
          Inspirado en los grandes juegos de estrategia por navegador de los 2000,
          reinterpretado con mecánicas modernas para 2026.
        </p>

        {oauthError && (
          <div className="mb-5 px-4 py-3 rounded max-w-sm w-full text-center"
            style={{ background: '#fef2f2', border: '1px solid #9b1a1a', color: '#9b1a1a' }}>
            <p className="font-ui text-xs">No fue posible iniciar sesión con Google. Inténtalo de nuevo.</p>
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-3 px-7 py-3.5 rounded font-ui font-bold tracking-wide text-sm transition-all duration-150 active:scale-[0.98] mb-3"
          style={{ background: '#ffffff', color: '#4a3820', border: '1px solid rgba(184,134,11,0.4)', boxShadow: '0 1px 4px rgba(60,40,10,0.1)' }}
          onMouseOver={e => (e.currentTarget.style.background = '#fef9e7')}
          onMouseOut={e => (e.currentTarget.style.background = '#ffffff')}
        >
          <GoogleIcon size={18} />
          Jugar gratis con Google
        </button>

      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: '#ffffff', borderTop: '1px solid rgba(184,134,11,0.15)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-ui text-[0.6rem] tracking-[0.28em] uppercase mb-3" style={{ color: '#8a6e1a' }}>
              Mecánicas de juego
            </p>
            <h2 className="font-display text-3xl sm:text-4xl tracking-[0.1em] uppercase" style={{ color: '#1c1208' }}>
              Todo en un universo vivo
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div key={title} className="rounded-lg p-6 flex flex-col gap-3"
                style={{ background: '#faf6ef', border: '1px solid rgba(184,134,11,0.2)' }}>
                <div className="w-9 h-9 rounded flex items-center justify-center"
                  style={{ background: 'rgba(184,134,11,0.1)', border: '1px solid rgba(184,134,11,0.25)' }}>
                  <Icon size={16} style={{ color: '#b8860b' }} />
                </div>
                <h3 className="font-ui text-sm font-semibold tracking-wide" style={{ color: '#1c1208' }}>{title}</h3>
                <p className="font-body text-sm leading-relaxed" style={{ color: '#4a3820' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ background: '#f4ead8', borderTop: '1px solid rgba(184,134,11,0.15)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-ui text-[0.6rem] tracking-[0.28em] uppercase mb-3" style={{ color: '#8a6e1a' }}>
              Cómo funciona
            </p>
            <h2 className="font-display text-3xl sm:text-4xl tracking-[0.1em] uppercase" style={{ color: '#1c1208' }}>
              Empieza en 3 pasos
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map(({ Icon, num, title, desc }) => (
              <div key={title} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-display text-3xl leading-none" style={{ color: 'rgba(184,134,11,0.3)' }}>{num}</span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ border: '1px solid rgba(184,134,11,0.3)', background: 'rgba(184,134,11,0.08)' }}>
                    <Icon size={14} style={{ color: '#b8860b' }} />
                  </div>
                </div>
                <div>
                  <h3 className="font-ui text-sm font-semibold tracking-wide mb-2" style={{ color: '#1c1208' }}>{title}</h3>
                  <p className="font-body text-sm leading-relaxed" style={{ color: '#4a3820' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6 text-center" style={{ background: '#ffffff', borderTop: '1px solid rgba(184,134,11,0.15)' }}>
        <div className="max-w-lg mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl tracking-[0.12em] uppercase mb-4" style={{ color: '#b8860b' }}>
            ¿Listo para gobernar?
          </h2>
          <p className="font-body text-base mb-8 leading-relaxed" style={{ color: '#4a3820' }}>
            Miles de reinos ya luchan por el dominio del universo. El tuyo te espera.
          </p>
          <button
            onClick={signInWithGoogle}
            className="inline-flex items-center gap-3 px-7 py-3.5 rounded font-ui font-bold tracking-wide text-sm transition-all duration-150 active:scale-[0.98]"
            style={{ background: '#b8860b', color: '#ffffff', border: 'none', boxShadow: '0 2px 8px rgba(184,134,11,0.35)' }}
            onMouseOver={e => (e.currentTarget.style.background = '#9a7010')}
            onMouseOut={e => (e.currentTarget.style.background = '#b8860b')}
          >
            <GoogleIcon size={18} />
            Jugar gratis con Google
          </button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="py-6 px-6" style={{ background: '#faf6ef', borderTop: '1px solid rgba(184,134,11,0.15)' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FeuduLogo variant="icon" height={20} />
            <span className="font-ui text-xs tracking-[0.18em] uppercase" style={{ color: '#8a7456' }}>
              Feudum · Anno MMXXVI
            </span>
          </div>
          <p className="font-ui text-xs text-center" style={{ color: '#8a7456' }}>
            Inspirado en{' '}
            <a href="https://github.com/lanedirt/OGameX" target="_blank" rel="noopener noreferrer"
              style={{ color: '#b8860b' }}>OGameX</a>
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
