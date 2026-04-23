import { Outlet, useLocation } from 'react-router-dom'
import { Loader2, Swords, Trophy, Crown, Star } from 'lucide-react'
import { useAuth } from '@/features/auth/useAuth'
import { useSeason, useJoinSeason, useSeasonSummary } from './useSeason'
import { useKingdoms } from '@/features/kingdom/useKingdom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDuration } from '@/lib/format'
import type { SeasonSummaryPlayer } from './types'

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

// ── Season summary screen (shown after season ends) ────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg">🥇</span>
  if (rank === 2) return <span className="text-lg">🥈</span>
  if (rank === 3) return <span className="text-lg">🥉</span>
  return <span className="font-ui text-sm text-ink-muted tabular-nums">#{rank}</span>
}

function PlayerRow({ player }: { player: SeasonSummaryPlayer }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
      player.isMe ? 'bg-gold/8 border border-gold/20' : 'hover:bg-parchment-warm'
    }`}>
      <div className="w-8 flex items-center justify-center shrink-0">
        <RankBadge rank={player.rank} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-ui text-sm font-semibold truncate ${player.isMe ? 'text-gold-light' : 'text-ink'}`}>
          {player.username ?? 'Jugador desconocido'}
          {player.isMe && <span className="ml-1.5 font-normal text-xs text-gold-dim">(tú)</span>}
        </p>
        <p className="font-body text-xs text-ink-muted mt-0.5 tabular-nums">
          {player.points.toLocaleString('es')} pts
          <span className="mx-1 text-ink-muted/40">·</span>
          {player.buildingPoints} edif.
          <span className="mx-1 text-ink-muted/40">·</span>
          {player.researchPoints} inv.
          <span className="mx-1 text-ink-muted/40">·</span>
          {player.unitPoints} ejér.
        </p>
      </div>
      {player.achievementsCount != null && player.achievementsCount > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          <Star size={10} className="text-gold-dim" />
          <span className="font-ui text-xs text-gold-dim tabular-nums">{player.achievementsCount}</span>
        </div>
      )}
    </div>
  )
}

function SeasonSummaryPage({ isAdmin }: { isAdmin: boolean }) {
  const { data, isLoading } = useSeasonSummary()
  const summary = data?.summary

  const seasonStart = summary?.seasonStart ?? 0
  const seasonEnd   = summary?.seasonEnd   ?? 0
  const duration    = seasonEnd > seasonStart ? seasonEnd - seasonStart : 0

  const conditionLabel: Record<string, string> = {
    admin_forced: 'fin administrativo',
    points:       'puntos',
    boss_killed:  'jefe derrotado',
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto space-y-6 py-12">
      {/* Header */}
      <div className="text-center space-y-3 anim-fade-up">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
            <Trophy size={28} className="text-gold" />
          </div>
        </div>
        <h1 className="font-ui text-2xl font-bold text-ink">
          Temporada {summary?.seasonNumber ?? '—'} finalizada
        </h1>
        {duration > 0 && (
          <p className="font-body text-sm text-ink-muted">
            Duración: {formatDuration(duration)}
          </p>
        )}
        <Badge variant="stone" className="inline-flex">Esperando nueva temporada</Badge>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      ) : summary ? (
        <>
          {/* Winner */}
          {summary.winner && (
            <Card className="p-4 anim-fade-up-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <Crown size={18} className="text-gold" />
                </div>
                <div>
                  <p className="font-ui text-xs text-ink-muted uppercase tracking-widest">Ganador de la temporada</p>
                  <p className="font-ui text-base font-bold text-ink mt-0.5">
                    {summary.winner.username ?? 'Desconocido'}
                  </p>
                  <p className="font-body text-xs text-ink-muted">
                    Victoria por {conditionLabel[summary.winner.condition] ?? summary.winner.condition}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* My position */}
          {summary.mySnapshot && (
            <Card className="p-4 anim-fade-up-1">
              <p className="font-ui text-xs text-ink-muted uppercase tracking-widest mb-3">Tu resultado</p>
              <PlayerRow player={{ ...summary.mySnapshot, isMe: true }} />
            </Card>
          )}

          {/* Leaderboard */}
          {summary.topPlayers.length > 0 && (
            <Card className="p-4 anim-fade-up-2">
              <p className="font-ui text-xs text-ink-muted uppercase tracking-widest mb-3">Clasificación final</p>
              <div className="space-y-1">
                {summary.topPlayers.map(p => (
                  <PlayerRow key={p.userId ?? p.username ?? p.rank} player={p} />
                ))}
              </div>
            </Card>
          )}
        </>
      ) : null}

      {isAdmin && (
        <div className="anim-fade-up-3 text-center space-y-2">
          <p className="font-ui text-xs text-ink-muted uppercase tracking-widest">Panel de administración</p>
          <a
            href="/admin"
            className="btn btn-primary inline-flex items-center gap-2 px-6 py-2.5"
          >
            Iniciar siguiente temporada
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

  // Season ended → show summary
  if (season?.seasonState === 'ended') {
    return <SeasonSummaryPage isAdmin={isAdmin} />
  }

  // No active season (null / never started)
  if (!season?.active) {
    return <SeasonWaitPage isAdmin={isAdmin} />
  }

  // Season active but no kingdom → show join screen
  const kingdoms = kingdomsData?.kingdoms ?? []
  if (kingdoms.length === 0) {
    return <JoinSeasonPage seasonNumber={season.seasonNumber} />
  }

  // All good — render normal game
  return <Outlet />
}
