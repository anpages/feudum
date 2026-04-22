import { useQuery } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { formatResource } from '@/lib/format'
import type { NpcTickResult, NpcAggregate } from '../types'

function timeAgo(unix: number, now: number) {
  const diff = now - unix
  if (diff < 90)   return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

function formatTs(unix: number) {
  return new Date(unix * 1000).toLocaleString('es-ES', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="glass rounded p-3 flex flex-col gap-0.5 min-w-0">
      <div className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted truncate">{label}</div>
      <div className="font-ui text-base font-bold text-ink">{value}</div>
      {sub && <div className="font-ui text-[0.6rem] text-ink-muted">{sub}</div>}
    </div>
  )
}

function LastTickCard({ tick, now }: { tick: NpcTickResult; now: number }) {
  return (
    <div className="glass rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-ui text-xs font-semibold uppercase tracking-widest text-ink-muted">Último tick</h3>
        <span className="font-ui text-xs text-gold">{formatTs(tick.at)} · hace {timeAgo(tick.at, now)}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <Stat label="NPCs" value={tick.npcCount} />
        <Stat label="Recursos ✓" value={tick.ticked} />
        <Stat label="Construyeron" value={tick.grew} />
        <Stat label="Atacaron" value={tick.attacked} />
        <Stat label="Carroñearon" value={tick.scavenged} />
        <Stat label="Expedición" value={tick.expeditioned} />
        <Stat label="Exped. resuel." value={tick.npcExpeditionsResolved} />
        <Stat label="Combates NPC" value={tick.npcVsNpcResolved} />
      </div>
    </div>
  )
}

function AggregatePanel({ agg }: { agg: NpcAggregate }) {
  const totalMissions = Object.values(agg.missionCounts).reduce((s, n) => s + n, 0)
  const attackActive = (agg.missionCounts['attack:active'] ?? 0)
  const expedActive  = (agg.missionCounts['expedition:active'] ?? 0)
    + (agg.missionCounts['expedition:exploring'] ?? 0)
    + (agg.missionCounts['expedition:returning'] ?? 0)
  const scavActive   = (agg.missionCounts['scavenge:active'] ?? 0)

  return (
    <div className="space-y-4">

      {/* Edificios */}
      <div>
        <h4 className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted mb-2">Edificios (avg / max)</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Barracks" value={agg.avgBarracks} sub={`max ${agg.maxBarracks}`} />
          <Stat label="Academy"  value={agg.avgAcademy}  sub={`max ${agg.maxAcademy}`} />
          <Stat label="Sawmill"  value={agg.avgSawmill} />
          <Stat label="Workshop" value={agg.avgWorkshop} />
        </div>
      </div>

      {/* Ejército */}
      <div>
        <h4 className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted mb-2">Ejército</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Avg ejército" value={agg.avgArmy} sub={`max ${agg.maxArmy}`} />
          <Stat label="Con ejército" value={`${agg.withArmy}/${agg.total}`} />
          <Stat label="Squires total" value={formatResource(agg.totalSquire)} />
          <Stat label="Distribución" value="" sub={
            Object.entries(agg.armyDistribution)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' · ')
          } />
        </div>
      </div>

      {/* Unidades de apoyo */}
      <div>
        <h4 className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted mb-2">Unidades de apoyo</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Con Merchant"  value={`${agg.withMerchant}/${agg.total}`}  sub={`${agg.totalMerchant} total`} />
          <Stat label="Con Caravan"   value={`${agg.withCaravan}/${agg.total}`}   sub={`${agg.totalCaravan} total`} />
          <Stat label="Con Scavenger" value={`${agg.withScavenger}/${agg.total}`} sub={`${agg.totalScavenger} total`} />
        </div>
      </div>

      {/* Recursos y misiones */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <h4 className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted mb-2">Recursos (avg por NPC)</h4>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Madera" value={formatResource(agg.avgWood)} />
            <Stat label="Piedra" value={formatResource(agg.avgStone)} />
            <Stat label="Grano"  value={formatResource(agg.avgGrain)} />
          </div>
        </div>
        <div>
          <h4 className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted mb-2">Misiones activas ({totalMissions})</h4>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Ataques"    value={attackActive} />
            <Stat label="Expedición" value={expedActive} />
            <Stat label="Carroñeo"   value={scavActive} />
          </div>
        </div>
      </div>

    </div>
  )
}

function HistoryTable({ history }: { history: NpcTickResult[] }) {
  const rows = [...history].reverse()
  return (
    <div>
      <h3 className="font-ui text-xs font-semibold uppercase tracking-widest text-ink-muted mb-2">
        Historial de ticks ({history.length})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full font-ui text-xs">
          <thead>
            <tr className="border-b border-gold/10 text-ink-muted uppercase tracking-wider text-[0.6rem]">
              <th className="text-left py-2 px-2">Hora</th>
              <th className="text-right py-2 px-2">Construy.</th>
              <th className="text-right py-2 px-2">Atacaron</th>
              <th className="text-right py-2 px-2">Carroñ.</th>
              <th className="text-right py-2 px-2">Exped.</th>
              <th className="text-right py-2 px-2">E.Resuel.</th>
              <th className="text-right py-2 px-2">Combates</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.at} className={`border-b border-gold/5 ${i === 0 ? 'bg-gold/5' : 'hover:bg-parchment-warm/3'} transition-colors`}>
                <td className="py-1.5 px-2 text-ink-muted tabular-nums">
                  {formatTs(t.at)}
                  {i === 0 && <span className="ml-2 text-[0.55rem] text-gold font-semibold uppercase">último</span>}
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-ink">{t.grew}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${t.attacked > 0 ? 'text-crimson-light' : 'text-ink-muted'}`}>{t.attacked}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${t.scavenged > 0 ? 'text-forest-light' : 'text-ink-muted'}`}>{t.scavenged}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${t.expeditioned > 0 ? 'text-gold' : 'text-ink-muted'}`}>{t.expeditioned}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-ink-muted">{t.npcExpeditionsResolved}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums ${t.npcVsNpcResolved > 0 ? 'text-ink' : 'text-ink-muted'}`}>{t.npcVsNpcResolved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function NpcMonitorTab() {
  const now = Math.floor(Date.now() / 1000)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'npc-stats'],
    queryFn: adminService.getNpcStats,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!data) return <p className="font-ui text-sm text-ink-muted text-center py-10">Sin datos todavía. El monitor se activa con el primer tick del cron.</p>

  const { lastTick, tickHistory, aggregate } = data

  return (
    <div className="space-y-6">

      {/* Sin datos de tick aún */}
      {!lastTick && (
        <div className="glass rounded-lg p-6 text-center">
          <p className="font-ui text-sm text-ink-muted">
            Sin historial de ticks todavía. Los datos se guardan a partir del próximo tick del cron.
          </p>
        </div>
      )}

      {lastTick && <LastTickCard tick={lastTick} now={now} />}

      {/* Aggregate stats actuales */}
      <div className="glass rounded-lg p-4">
        <h3 className="font-ui text-xs font-semibold uppercase tracking-widest text-ink-muted mb-4">
          Estado actual — {aggregate.total} NPCs · {aggregate.bosses} jefe(s)
        </h3>
        <AggregatePanel agg={aggregate} />
      </div>

      {tickHistory.length > 0 && <HistoryTable history={tickHistory} />}

    </div>
  )
}
