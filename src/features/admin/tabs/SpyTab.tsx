import { useQuery } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { formatResource } from '@/lib/format'
import type { AdminSpyMission } from '../types'

function formatTs(unix: number) {
  return new Date(unix * 1000).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function eta(unix: number, now: number) {
  const diff = unix - now
  if (diff <= 0) return 'ya'
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="glass rounded-xl p-4 space-y-1">
      <p className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted">{label}</p>
      <p className={`font-ui text-2xl font-bold tabular-nums ${accent ?? 'text-ink'}`}>{value}</p>
    </div>
  )
}

function stateLabel(state: string) {
  if (state === 'active')    return <span className="badge badge-gold text-[0.55rem]">En vuelo</span>
  if (state === 'returning') return <span className="badge badge-forest text-[0.55rem]">Retornando</span>
  return <span className="badge badge-stone text-[0.55rem]">Completado</span>
}

function SpyRow({ m, now }: { m: AdminSpyMission; now: number }) {
  const isActive = m.state === 'active' || m.state === 'returning'
  const timeMark = m.state === 'returning' ? m.returnTime : m.arrivalTime
  const label    = m.state === 'returning' ? 'Retorna en' : m.state === 'active' ? 'Llega en' : 'Salida'
  const resourceTotal = (m.resources?.wood ?? 0) + (m.resources?.stone ?? 0) + (m.resources?.grain ?? 0)

  return (
    <div className="py-3 border-b border-gold/8 last:border-0 px-4 -mx-4">
      {/* ── Mobile layout ── */}
      <div className="sm:hidden space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-ui text-[0.6rem] text-ink-muted tabular-nums shrink-0">{formatTs(m.departureTime)}</p>
            {stateLabel(m.state)}
          </div>
          {isActive && timeMark ? (
            <p className="font-ui text-xs tabular-nums text-gold shrink-0">{eta(timeMark, now)}</p>
          ) : !isActive && (
            <p className={`font-ui text-[0.6rem] font-semibold shrink-0 ${m.detected ? 'text-crimson-light' : 'text-forest-light'}`}>
              {m.detected ? 'Detectado' : 'No detectado'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <div className="min-w-0">
            <p className="font-ui text-[0.55rem] text-ink-muted">Espía</p>
            <p className="font-ui text-xs font-semibold text-ink truncate">{m.attackerName}</p>
            <p className="font-ui text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot}</p>
            {m.scouts > 0 && <p className="font-ui text-[0.55rem] text-gold/80">{m.scouts} explorador{m.scouts > 1 ? 'es' : ''}</p>}
          </div>
          <div className="min-w-0">
            <p className="font-ui text-[0.55rem] text-ink-muted">Objetivo</p>
            <p className="font-ui text-xs font-semibold text-ink truncate">{m.targetName}</p>
            <p className="font-ui text-[0.6rem] text-ink-muted">{m.targetRealm}:{m.targetRegion}:{m.targetSlot}</p>
            {m.targetIsNpc
              ? <span className="font-ui text-[0.55rem] text-ink-muted/60">NPC</span>
              : <span className="font-ui text-[0.55rem] text-forest-light">Jugador</span>
            }
          </div>
        </div>

        {!isActive && (resourceTotal > 0 || m.hasUnits || m.hasDefense) && (
          <div className="flex items-center gap-2 flex-wrap">
            {resourceTotal > 0 && (
              <p className="font-ui text-[0.6rem] text-gold tabular-nums">{formatResource(resourceTotal)} recursos</p>
            )}
            {m.hasUnits   && <span className="badge badge-crimson text-[0.5rem]">Tropas</span>}
            {m.hasDefense && <span className="badge badge-stone text-[0.5rem]">Defensas</span>}
          </div>
        )}
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden sm:grid grid-cols-[auto_1fr_1fr_auto_auto] items-start gap-x-4">
        <div className="min-w-[72px] space-y-1">
          <p className="font-ui text-[0.6rem] text-ink-muted tabular-nums">{formatTs(m.departureTime)}</p>
          {stateLabel(m.state)}
        </div>

        <div className="min-w-0">
          <p className="font-ui text-[0.6rem] text-ink-muted">Espía</p>
          <p className="font-ui text-xs font-semibold text-ink truncate">{m.attackerName}</p>
          <p className="font-ui text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot}</p>
          {m.scouts > 0 && <p className="font-ui text-[0.55rem] text-gold/80">{m.scouts} explorador{m.scouts > 1 ? 'es' : ''}</p>}
        </div>

        <div className="min-w-0">
          <p className="font-ui text-[0.6rem] text-ink-muted">Objetivo</p>
          <p className="font-ui text-xs font-semibold text-ink truncate">{m.targetName}</p>
          <p className="font-ui text-[0.6rem] text-ink-muted">{m.targetRealm}:{m.targetRegion}:{m.targetSlot}</p>
          {m.targetIsNpc
            ? <span className="font-ui text-[0.55rem] text-ink-muted/60">NPC</span>
            : <span className="font-ui text-[0.55rem] text-forest-light">Jugador</span>
          }
        </div>

        <div className="text-right min-w-[60px]">
          <p className="font-ui text-[0.6rem] text-ink-muted">{label}</p>
          {isActive && timeMark
            ? <p className="font-ui text-xs tabular-nums text-gold">{eta(timeMark, now)}</p>
            : <p className="font-ui text-[0.6rem] text-ink-muted">{formatTs(m.departureTime)}</p>
          }
        </div>

        <div className="text-right min-w-[80px] space-y-0.5">
          {!isActive && (
            <>
              {m.detected
                ? <p className="font-ui text-[0.6rem] text-crimson-light font-semibold">Detectado</p>
                : <p className="font-ui text-[0.6rem] text-forest-light font-semibold">No detectado</p>
              }
              {m.resources && (
                <p className="font-ui text-[0.6rem] text-gold tabular-nums">
                  {formatResource(resourceTotal)} recursos
                </p>
              )}
              <div className="flex gap-1 justify-end flex-wrap">
                {m.hasUnits   && <span className="badge badge-crimson text-[0.5rem]">Tropas</span>}
                {m.hasDefense && <span className="badge badge-stone text-[0.5rem]">Defensas</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function SpyTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'spy-missions'],
    queryFn: adminService.getSpyMissions,
    refetchInterval: 10_000,
  })

  const now = data?.now ?? Math.floor(Date.now() / 1000)

  return (
    <div className="space-y-5">

      <div className="glass rounded-xl p-4 space-y-1">
        <p className="font-ui text-xs font-semibold text-ink">¿Cómo funciona el espionaje NPC?</p>
        <p className="font-ui text-[0.7rem] text-ink-muted leading-relaxed">
          Los NPCs con exploradores (cuartel 3 + espionaje 2) espían antes de atacar. Sin scouts, solo usan el filtro de recursos (atacan si el objetivo tiene ≥30% de sus propios recursos). El resultado del espía determina si el ataque procede según el ratio de riesgo: economy (1.5×), balanced (0.8×), military (0.5×).
        </p>
      </div>

      {data?.metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Activas ahora"    value={data.metrics.activeNow} />
          <StatCard label="Enviadas (24h)"   value={data.metrics.sent24h} />
          <StatCard label="Detectadas (24h)" value={data.metrics.detected24h} accent={data.metrics.detected24h > 0 ? 'text-crimson-light' : 'text-ink'} />
          <StatCard label="Con intel recurs." value={data.metrics.withResources} accent={data.metrics.withResources > 0 ? 'text-gold' : 'text-ink'} />
        </div>
      )}

      <div className="card-medieval p-5 space-y-3">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <h3 className="section-heading">Misiones activas</h3>
        {isLoading ? (
          <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="skeleton h-14 rounded" />)}</div>
        ) : !data?.active.length ? (
          <p className="font-ui text-sm text-ink-muted text-center py-6">Sin misiones de espionaje activas.</p>
        ) : (
          data.active.map(m => <SpyRow key={m.id} m={m} now={now} />)
        )}
      </div>

      <div className="card-medieval p-5 space-y-3">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <h3 className="section-heading">Historial reciente (7 días)</h3>
        {isLoading ? (
          <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="skeleton h-14 rounded" />)}</div>
        ) : !data?.recent.length ? (
          <p className="font-ui text-sm text-ink-muted text-center py-6">Sin espionajes recientes.</p>
        ) : (
          data.recent.slice(0, 50).map(m => <SpyRow key={m.id} m={m} now={now} />)
        )}
      </div>

    </div>
  )
}
