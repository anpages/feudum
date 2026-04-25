import { useQuery } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { formatResource } from '@/lib/format'
import type { AdminScavengeMission } from '../types'

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

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="glass rounded-xl p-4 space-y-1">
      <p className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted">{label}</p>
      <p className={`font-ui text-2xl font-bold tabular-nums ${accent ?? 'text-ink'}`}>{value}</p>
      {sub && <p className="font-ui text-[0.6rem] text-ink-muted">{sub}</p>}
    </div>
  )
}

function stateLabel(state: string) {
  if (state === 'active')    return <span className="badge badge-gold text-[0.55rem]">En vuelo</span>
  if (state === 'returning') return <span className="badge badge-forest text-[0.55rem]">Retornando</span>
  return <span className="badge badge-stone text-[0.55rem]">Completado</span>
}

function ScavengeRow({ m, now }: { m: AdminScavengeMission; now: number }) {
  const isActive   = m.state === 'active' || m.state === 'returning'
  const timeMark   = m.state === 'returning' ? m.returnTime : m.arrivalTime
  const timeLabel  = m.state === 'returning' ? 'Retorna en' : 'Llega en'
  const collected  = (m.woodLoad ?? 0) + (m.stoneLoad ?? 0)
  const debrisLeft = (m.debrisNow?.wood ?? 0) + (m.debrisNow?.stone ?? 0)

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
          ) : !isActive && collected > 0 ? (
            <p className="font-ui text-xs font-semibold text-gold tabular-nums shrink-0">{formatResource(collected)}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <div className="min-w-0">
            <p className="font-ui text-[0.55rem] text-ink-muted">Carroñero</p>
            <p className="font-ui text-xs font-semibold text-ink truncate">{m.attackerName}</p>
            <p className="font-ui text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot}</p>
          </div>
          <div className="min-w-0">
            <p className="font-ui text-[0.55rem] text-ink-muted">Escombros</p>
            <p className="font-ui text-xs font-semibold text-ink">{m.targetCoord}</p>
            {debrisLeft > 0
              ? <p className="font-ui text-[0.6rem] text-gold tabular-nums">{formatResource(debrisLeft)} disp.</p>
              : <p className="font-ui text-[0.6rem] text-ink-muted/50">Campo vacío</p>
            }
          </div>
        </div>

        {!isActive && collected > 0 && (
          <div className="flex gap-3 font-ui text-[0.55rem] text-ink-muted">
            {m.woodLoad  > 0 && <span>Madera: {formatResource(m.woodLoad)}</span>}
            {m.stoneLoad > 0 && <span>Piedra: {formatResource(m.stoneLoad)}</span>}
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
          <p className="font-ui text-[0.6rem] text-ink-muted">Carroñero</p>
          <p className="font-ui text-xs font-semibold text-ink truncate">{m.attackerName}</p>
          <p className="font-ui text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot}</p>
        </div>

        <div className="min-w-0">
          <p className="font-ui text-[0.6rem] text-ink-muted">Campo de escombros</p>
          <p className="font-ui text-xs font-semibold text-ink">{m.targetCoord}</p>
          {debrisLeft > 0
            ? <p className="font-ui text-[0.6rem] text-gold tabular-nums">{formatResource(debrisLeft)} disponibles</p>
            : <p className="font-ui text-[0.6rem] text-ink-muted/50">Campo vacío</p>
          }
        </div>

        <div className="text-right min-w-[60px]">
          {isActive && timeMark ? (
            <>
              <p className="font-ui text-[0.6rem] text-ink-muted">{timeLabel}</p>
              <p className="font-ui text-xs tabular-nums text-gold">{eta(timeMark, now)}</p>
            </>
          ) : (
            <p className="font-ui text-[0.6rem] text-ink-muted">{formatTs(m.departureTime)}</p>
          )}
        </div>

        <div className="text-right min-w-[72px]">
          {!isActive && collected > 0 && (
            <>
              <p className="font-ui text-[0.6rem] text-ink-muted">Recogido</p>
              <p className="font-ui text-xs font-semibold text-gold tabular-nums">{formatResource(collected)}</p>
              {m.woodLoad  > 0 && <p className="font-ui text-[0.55rem] text-ink-muted">M: {formatResource(m.woodLoad)}</p>}
              {m.stoneLoad > 0 && <p className="font-ui text-[0.55rem] text-ink-muted">P: {formatResource(m.stoneLoad)}</p>}
            </>
          )}
          {!isActive && collected === 0 && (
            <p className="font-ui text-[0.6rem] text-ink-muted/50">—</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function ScavengeTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'scavenge-missions'],
    queryFn: adminService.getScavengeMissions,
    refetchInterval: 15_000,
  })

  const now = data?.now ?? Math.floor(Date.now() / 1000)

  return (
    <div className="space-y-5">

      <div className="glass rounded-xl p-4 space-y-1">
        <p className="font-ui text-xs font-semibold text-ink">¿Qué NPCs carroñean y cuándo?</p>
        <p className="font-ui text-[0.7rem] text-ink-muted leading-relaxed">
          Solo NPCs con saqueadores (cuartel 4 + equitación 6 + runemastery 2). Collector/economy: 80% de probabilidad por tick (cada 20 min), priorizados antes de atacar. Military: 20%. Balanced: 40%. Solo buscan escombros en su misma región con ≥500 recursos disponibles.
        </p>
      </div>

      {data?.metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Activas ahora"       value={data.metrics.activeNow} />
          <StatCard label="Enviadas (24h)"       value={data.metrics.sent24h} />
          <StatCard label="Campos de escombros"  value={data.metrics.activeDebrisFields}
            sub={`${formatResource(data.metrics.totalDebrisAvailable)} total disponible`}
            accent={data.metrics.activeDebrisFields > 0 ? 'text-gold' : 'text-ink'}
          />
          <StatCard label="Madera recogida (24h)"  value={formatResource(data.metrics.collected24hWood)}  accent="text-forest-light" />
          <StatCard label="Piedra recogida (24h)"  value={formatResource(data.metrics.collected24hStone)} accent="text-forest-light" />
          <StatCard label="Total recogido (24h)"
            value={formatResource((data.metrics.collected24hWood ?? 0) + (data.metrics.collected24hStone ?? 0))}
            accent={(data.metrics.collected24hWood + data.metrics.collected24hStone) > 0 ? 'text-gold' : 'text-ink'}
          />
        </div>
      )}

      <div className="card-medieval p-5 space-y-3">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <h3 className="section-heading">Misiones activas</h3>
        {isLoading ? (
          <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="skeleton h-14 rounded" />)}</div>
        ) : !data?.active.length ? (
          <p className="font-ui text-sm text-ink-muted text-center py-6">Sin misiones de carroñeo activas.</p>
        ) : (
          data.active.map(m => <ScavengeRow key={m.id} m={m} now={now} />)
        )}
      </div>

      <div className="card-medieval p-5 space-y-3">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <h3 className="section-heading">Historial reciente (7 días)</h3>
        {isLoading ? (
          <div className="space-y-2">{[0,1,2].map(i => <div key={i} className="skeleton h-14 rounded" />)}</div>
        ) : !data?.recent.length ? (
          <p className="font-ui text-sm text-ink-muted text-center py-6">Sin carroñeos recientes.</p>
        ) : (
          data.recent.slice(0, 50).map(m => <ScavengeRow key={m.id} m={m} now={now} />)
        )}
      </div>

    </div>
  )
}
