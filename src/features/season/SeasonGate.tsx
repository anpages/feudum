import { Outlet, useLocation } from 'react-router-dom'
import { Loader2, Swords } from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useSeason, useJoinSeason } from './useSeason'
import { useKingdoms } from '@/features/kingdom/useKingdom'
import { Button } from '@/components/ui/Button'

// ── No active season screen ────────────────────────────────────────────────────

function SeasonWaitPage({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-3 max-w-md anim-fade-up">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Swords size={28} className="text-gold-dim" />
          </div>
        </div>
        <h1 className="font-ui text-2xl font-bold text-ink">Sin temporada activa</h1>
        <p className="font-body text-sm text-ink-muted leading-relaxed">
          El servidor está entre temporadas. Vuelve pronto o espera a que el administrador
          inicie la siguiente temporada.
        </p>
      </div>

      {isAdmin && (
        <div className="anim-fade-up-1 text-center space-y-2">
          <p className="font-ui text-xs text-ink-muted uppercase tracking-widest">Panel de administración</p>
          <a
            href="/admin"
            className="btn btn-primary inline-flex items-center gap-2 px-6 py-2.5"
          >
            Ir al panel admin
          </a>
        </div>
      )}
    </div>
  )
}

// ── Join season screen ─────────────────────────────────────────────────────────

function JoinSeasonPage({ seasonNumber }: { seasonNumber: number }) {
  const join = useJoinSeason()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-3 max-w-md anim-fade-up">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Swords size={28} className="text-gold" />
          </div>
        </div>
        <h1 className="font-ui text-2xl font-bold text-ink">Temporada {seasonNumber}</h1>
        <p className="font-body text-sm text-ink-muted leading-relaxed">
          La temporada está en curso. Para participar, únete ahora y se te asignará
          un reino en el mapa. Si te unes tarde empezarás de cero, pero aún podrás
          competir mientras queden plazas.
        </p>
        <p className="font-ui text-xs text-ink-muted">
          Solo podrás unirte si hay slots libres en el mapa.
        </p>
      </div>

      <div className="anim-fade-up-1 text-center space-y-3">
        {join.error && (
          <p className="font-ui text-xs text-crimson-light">
            {(join.error as Error).message === 'no_slots_available'
              ? 'No quedan slots libres. Espera a la siguiente temporada.'
              : 'Error al unirse. Inténtalo de nuevo.'}
          </p>
        )}
        <Button
          variant="primary"
          size="lg"
          onClick={() => join.mutate()}
          disabled={join.isPending}
        >
          {join.isPending
            ? <><Loader2 size={16} className="animate-spin" /> Uniéndose…</>
            : 'Comenzar temporada'}
        </Button>
      </div>
    </div>
  )
}

// ── Season gate — wraps all protected game routes ──────────────────────────────

export function SeasonRoute() {
  const { pathname } = useLocation()
  const { user, isLoading: authLoading } = useAuth()
  const { data: season, isLoading: seasonLoading } = useSeason()
  const { data: kingdomsData, isLoading: kingdomsLoading } = useKingdoms()

  const isAdmin = user?.role === 'admin'

  // Always let admins through to the admin panel
  if (pathname.startsWith('/admin') && isAdmin) {
    return <Outlet />
  }

  if (authLoading || seasonLoading || kingdomsLoading) return null

  // No active season
  if (!season?.active) {
    return <SeasonWaitPage isAdmin={isAdmin} />
  }

  // Season active but no kingdom → show join screen (except admin going to /admin)
  const kingdoms = kingdomsData?.kingdoms ?? []
  if (kingdoms.length === 0) {
    return <JoinSeasonPage seasonNumber={season.seasonNumber} />
  }

  // All good — render normal game
  return <Outlet />
}
