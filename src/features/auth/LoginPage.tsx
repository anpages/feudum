import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'
import { FeuduLogo } from '@/components/FeuduLogo'
import { Castle, FlaskConical, Swords, Map, Shield, ChevronDown } from 'lucide-react'

const STATS = [
  { value: '2.847', label: 'Reinos activos' },
  { value: '143',   label: 'Batallas hoy' },
  { value: '891',   label: 'Ejércitos en marcha' },
]

const FEATURES = [
  {
    num: 'I',
    Icon: Castle,
    title: 'Construye tu reino',
    desc: 'Levanta aserraderos, canteras y granjas. Amplía tu producción con talleres, gremios y catedrales. Cada edificio refuerza tu economía de guerra.',
  },
  {
    num: 'II',
    Icon: FlaskConical,
    title: 'Domina la academia',
    desc: 'Investiga tecnologías de combate, logística y arcanas. Cada nivel puede marcar la diferencia entre la victoria y el colapso de tu ejército.',
  },
  {
    num: 'III',
    Icon: Swords,
    title: 'Forja tus ejércitos',
    desc: 'Entrena escuderos, caballeros y paladines. Lanza ataques, espionajes y pillajes contra rivales humanos — o contra NPCs que crecen sin descanso.',
  },
  {
    num: 'IV',
    Icon: Map,
    title: 'Expande tu dominio',
    desc: 'Coloniza territorios en el mapa del universo. Coordina múltiples reinos y construye un imperio que trascienda las temporadas.',
  },
]

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const oauthError = searchParams.get('error')
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen bg-game text-parchment overflow-x-hidden">

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden">

        {/* Radial gold glow — pulsing */}
        <div
          className="absolute pointer-events-none anim-hero-pulse"
          style={{
            top: '12%', left: '50%',
            width: 760, height: 760,
            background: 'radial-gradient(circle, rgba(201,162,39,0.11) 0%, transparent 62%)',
          }}
        />
        {/* Bottom gradient fade */}
        <div
          className="absolute bottom-0 inset-x-0 h-48 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #0a0705 0%, transparent 100%)' }}
        />

        {/* Corner brackets */}
        <div className="absolute top-7 left-7 w-10 h-10 border-t border-l border-gold/20 pointer-events-none" />
        <div className="absolute top-7 right-7 w-10 h-10 border-t border-r border-gold/20 pointer-events-none" />
        <div className="absolute bottom-7 left-7 w-10 h-10 border-b border-l border-gold/20 pointer-events-none" />
        <div className="absolute bottom-7 right-7 w-10 h-10 border-b border-r border-gold/20 pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">

          {/* Logo */}
          <div className="mb-7 anim-float anim-glow">
            <FeuduLogo variant="icon" height={96} />
          </div>

          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px w-14 bg-gradient-to-r from-transparent to-gold/30" />
            <span className="font-ui text-[0.55rem] text-gold-dim/55 tracking-[0.38em] uppercase">Anno MMXXVI</span>
            <div className="h-px w-14 bg-gradient-to-l from-transparent to-gold/30" />
          </div>

          {/* Title */}
          <h1 className="font-display text-[4.5rem] sm:text-[7rem] text-gold-light tracking-[0.18em] uppercase leading-none mb-5">
            Feudum
          </h1>

          {/* Description */}
          <p className="font-body text-parchment-dim text-lg sm:text-xl max-w-lg leading-relaxed mb-2">
            Estrategia medieval multijugador en tiempo real.
          </p>
          <p className="font-body text-parchment-dim/50 text-sm sm:text-base max-w-md leading-relaxed mb-10">
            Construye tu reino, entrena ejércitos y conquista el universo.
            El mundo sigue moviéndose — con o sin ti.
          </p>

          {/* CTA */}
          <div className="w-full max-w-[300px]">
            {oauthError && (
              <div className="mb-4 px-3 py-2.5 rounded-sm bg-crimson/5 border border-crimson/15">
                <p className="font-ui text-xs text-crimson leading-snug">
                  No fue posible iniciar sesión con Google. Inténtalo de nuevo.
                </p>
              </div>
            )}

            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded border border-gold/25 bg-parchment hover:bg-gold-soft active:scale-[0.99] transition-all duration-150 font-ui font-bold text-ink-mid tracking-wide text-sm shadow-lg hover:shadow-xl hover:border-gold/40"
            >
              <GoogleIcon />
              Entrar con Google
            </button>

            <p className="font-ui text-[0.5rem] text-parchment-dim/20 text-center mt-3 tracking-[0.18em] uppercase">
              Gratis · Sin microtransacciones · Estrategia pura
            </p>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-20 animate-bounce">
          <ChevronDown size={18} className="text-gold" />
        </div>
      </section>

      {/* ── LIVE UNIVERSE STATS ─────────────────────────────────────── */}
      <div className="border-y border-gold/10 py-6 glass">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-forest-light animate-pulse shrink-0" />
            <span className="font-ui text-[0.55rem] text-parchment-dim/40 tracking-[0.32em] uppercase">Universo en tiempo real</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-gold/8">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center px-4">
                <div className="font-display text-2xl sm:text-3xl text-gold-light tabular-nums">{value}</div>
                <div className="font-ui text-[0.58rem] text-parchment-dim/40 tracking-wider uppercase mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURES — Codex style ───────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">

          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="h-px flex-1 max-w-[72px] bg-gold/15" />
              <span className="font-ui text-[0.55rem] text-gold-dim/45 tracking-[0.32em] uppercase">El camino a la victoria</span>
              <div className="h-px flex-1 max-w-[72px] bg-gold/15" />
            </div>
            <h2 className="font-display text-3xl sm:text-4xl text-gold-light tracking-[0.12em] uppercase">
              Domina cada frente
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gold/8 border border-gold/8">
            {FEATURES.map(({ num, Icon, title, desc }) => (
              <div
                key={title}
                className="relative bg-obsidian p-8 group hover:bg-tomb transition-colors duration-300 overflow-hidden"
              >
                {/* Hover glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(circle at 20% 20%, rgba(201,162,39,0.05), transparent 55%)' }}
                />
                <div className="flex items-start gap-5">
                  <span className="font-display text-[3.5rem] leading-none text-gold/7 group-hover:text-gold/15 transition-colors duration-300 shrink-0 select-none mt-0.5">
                    {num}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 mb-3">
                      <Icon size={13} className="text-gold shrink-0" />
                      <h3 className="font-ui text-xs font-semibold text-parchment tracking-[0.15em] uppercase">{title}</h3>
                    </div>
                    <p className="font-body text-sm text-parchment-dim/55 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMBAT — Dark warning ────────────────────────────────────── */}
      <section className="relative py-16 px-6 border-y border-gold/8 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(139,26,26,0.09) 0%, transparent 65%)' }}
        />
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <Shield size={18} className="text-crimson-light mx-auto mb-5 opacity-40" />
          <h2 className="font-display text-3xl sm:text-4xl text-parchment tracking-[0.1em] uppercase mb-5 leading-tight">
            El campo de batalla<br className="hidden sm:block" /> no perdona
          </h2>
          <p className="font-body text-parchment-dim/65 text-base sm:text-lg leading-relaxed mb-4">
            Motor de combate por rondas con escudos, blindaje y fuego de supresión.
            Cada unidad tiene estadísticas únicas. Los errores estratégicos se pagan con sangre.
          </p>
          <p className="font-body text-parchment-dim/30 text-sm leading-relaxed">
            Los NPCs crecen y atacan aunque no estés conectado.
            Los mejores jugadores arrebatan el trono al Jefe Dragón cada temporada.
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-xs mx-auto">
          <FeuduLogo variant="icon" height={44} className="mx-auto mb-6 opacity-40" />
          <h2 className="font-display text-2xl text-gold-light tracking-[0.18em] uppercase mb-2">
            ¿Estás listo?
          </h2>
          <p className="font-body text-parchment-dim/40 text-sm mb-8">
            Miles de reinos ya luchan. El tuyo te espera.
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded border border-gold/25 bg-parchment hover:bg-gold-soft active:scale-[0.99] transition-all duration-150 font-ui font-bold text-ink-mid tracking-wide text-sm shadow-lg hover:border-gold/40"
          >
            <GoogleIcon />
            Forja tu reino
          </button>
          <div className="divider mt-7 mb-3">◆</div>
          <p className="font-ui text-[0.48rem] text-parchment-dim/15 tracking-[0.22em] uppercase select-none">
            Feudum · Anno MMXXVI
          </p>
        </div>
      </section>

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
