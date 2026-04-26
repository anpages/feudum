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

function stateBadge(state: string) {
  if (state === 'active')    return <span className="badge badge-gold text-[0.55rem]">En vuelo</span>
  if (state === 'returning') return <span className="badge badge-forest text-[0.55rem]">Retornando</span>
  return <span className="badge badge-stone text-[0.55rem]">Completado</span>
}

const TH = 'text-left py-2 px-2 font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted whitespace-nowrap'
const TD = 'py-2 px-2 font-ui text-xs whitespace-nowrap align-top'

function SpyTable({ missions, now }: { missions: AdminSpyMission[]; now: number }) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gold/20">
            <th className={TH}>Fecha / Estado</th>
            <th className={TH}>Espía</th>
            <th className={TH}>Objetivo</th>
            <th className={`${TH} text-right`}>Tiempo</th>
            <th className={`${TH} text-right`}>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {missions.map(m => {
            const isActive = m.state === 'active' || m.state === 'returning'
            const timeMark = m.state === 'returning' ? m.returnTime : m.arrivalTime
            const timeLabel = m.state === 'returning' ? 'Retorna en' : m.state === 'active' ? 'Llega en' : 'Salida'
            const resourceTotal = (m.resources?.wood ?? 0) + (m.resources?.stone ?? 0) + (m.resources?.grain ?? 0)

            return (
              <tr key={m.id} className="border-b border-gold/8 last:border-0 hover:bg-parchment-warm/30 transition-colors">
                <td className={TD}>
                  <p className="text-[0.6rem] text-ink-muted tabular-nums">{formatTs(m.departureTime)}</p>
                  {stateBadge(m.state)}
                </td>
                <td className={TD}>
                  <p className="font-semibold text-ink">{m.attackerName}</p>
                  <p className="text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot}</p>
                  {m.scouts > 0 && <p className="text-[0.55rem] text-gold/80">{m.scouts} explorador{m.scouts > 1 ? 'es' : ''}</p>}
                </td>
                <td className={TD}>
                  <p className="font-semibold text-ink">{m.targetName}</p>
                  <p className="text-[0.6rem] text-ink-muted">{m.targetRealm}:{m.targetRegion}:{m.targetSlot}</p>
                  {m.targetIsNpc
                    ? <span className="text-[0.55rem] text-ink-muted/60">NPC</span>
                    : <span className="text-[0.55rem] text-forest-light">Jugador</span>
                  }
                </td>
                <td className={`${TD} text-right`}>
                  <p className="text-[0.6rem] text-ink-muted">{timeLabel}</p>
                  {isActive && timeMark
                    ? <p className="tabular-nums text-gold">{eta(timeMark, now)}</p>
                    : <p className="text-[0.6rem] text-ink-muted tabular-nums">{formatTs(m.departureTime)}</p>
                  }
                </td>
                <td className={`${TD} text-right`}>
                  {!isActive && (
                    <>
                      {m.detected
                        ? <p className="text-[0.6rem] text-crimson-light font-semibold">Detectado</p>
                        : <p className="text-[0.6rem] text-forest-light font-semibold">No detectado</p>
                      }
                      {m.resources && resourceTotal > 0 && (
                        <p className="text-[0.6rem] text-gold tabular-nums">{formatResource(resourceTotal)}</p>
                      )}
                      <div className="flex gap-1 justify-end flex-wrap mt-0.5">
                        {m.hasUnits   && <span className="badge badge-crimson text-[0.5rem]">Tropas</span>}
                        {m.hasDefense && <span className="badge badge-stone text-[0.5rem]">Defensas</span>}
                      </div>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
          <SpyTable missions={data.active} now={now} />
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
          <SpyTable missions={data.recent.slice(0, 50)} now={now} />
        )}
      </div>

    </div>
  )
}
