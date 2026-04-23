import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { formatResource } from '@/lib/format'
import type { NpcTickResult, NpcDecision } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(unix: number, now: number) {
  const d = now - unix
  if (d < 90)   return `${d}s`
  if (d < 3600) return `${Math.floor(d / 60)} min`
  return `${Math.floor(d / 3600)}h ${Math.floor((d % 3600) / 60)}m`
}

function formatTs(unix: number) {
  return new Date(unix * 1000).toLocaleTimeString('es-ES', {
    hour: '2-digit', minute: '2-digit',
  })
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round(n / total * 100) : 0
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TickStatusBar({ tick, now }: { tick: NpcTickResult; now: number }) {
  const age  = now - tick.at
  const fresh = age < 900  // less than 15 min

  return (
    <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-4">
      {/* Status dot */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full ${fresh ? 'bg-forest-light animate-pulse' : 'bg-ink-muted'}`} />
        <span className="font-ui text-xs font-semibold text-ink">
          {fresh ? 'Activo' : 'Sin actividad reciente'}
        </span>
      </div>
      <div className="w-px h-4 bg-gold/20 hidden sm:block" />
      {/* Last tick */}
      <div className="flex items-center gap-1.5 font-ui text-xs text-ink-muted">
        <span className="text-ink-muted">Último tick:</span>
        <span className="text-ink font-semibold">{formatTs(tick.at)}</span>
        <span className="text-ink-muted">· hace {timeAgo(tick.at, now)}</span>
      </div>
      <div className="w-px h-4 bg-gold/20 hidden sm:block" />
      {/* Quick stats */}
      <div className="flex flex-wrap items-center gap-3 ml-auto">
        <TickPill label="edificios" value={tick.builtBuilding} color={tick.builtBuilding > 0 ? 'text-forest-light'  : 'text-ink-muted'} />
        <TickPill label="ataque"    value={tick.trainedCombat}  color={tick.trainedCombat  > 0 ? 'text-crimson-light' : 'text-ink-muted'} />
        <TickPill label="defensas"  value={tick.trainedDefense} color={tick.trainedDefense > 0 ? 'text-gold'          : 'text-ink-muted'} />
        <TickPill label="apoyo"     value={tick.trainedSupport} color={tick.trainedSupport > 0 ? 'text-gold-light'    : 'text-ink-muted'} />
        <TickPill label="combates"  value={tick.attacked}       color={tick.attacked       > 0 ? 'text-crimson-light' : 'text-ink-muted'} />
        <TickPill label="expedición" value={tick.expeditioned}  color={tick.expeditioned   > 0 ? 'text-gold'          : 'text-ink-muted'} />
      </div>
    </div>
  )
}

function TickPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className={`font-ui text-sm font-bold tabular-nums ${color}`}>{value}</span>
      <span className="font-ui text-[0.6rem] text-ink-muted">{label}</span>
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="card-medieval p-4 flex flex-col gap-1">
      <div className="card-corner-tr" /><div className="card-corner-bl" />
      <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted">{label}</span>
      <span className={`font-ui text-2xl font-bold tabular-nums ${accent ?? 'text-ink'}`}>{value}</span>
      {sub && <span className="font-ui text-[0.6rem] text-ink-muted">{sub}</span>}
    </div>
  )
}

function FillBar({ value, max, color = 'bg-gold' }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.min(100, value / max * 100) : 0
  return (
    <div className="progress-track h-1.5">
      <div className={`progress-fill ${color}`} style={{ width: `${w}%` }} />
    </div>
  )
}

function ArmyDistribution({ dist, total }: { dist: Record<string, number>; total: number }) {
  const buckets = [
    { key: '0',     label: 'Sin ejército', color: 'bg-ink-muted/30' },
    { key: '1-10',  label: '1–10',         color: 'bg-gold/40' },
    { key: '11-50', label: '11–50',         color: 'bg-gold/70' },
    { key: '51-200',label: '51–200',        color: 'bg-gold' },
    { key: '200+',  label: '200+',          color: 'bg-forest-light' },
  ]
  return (
    <div className="space-y-1.5">
      {/* Stacked bar */}
      <div className="flex h-3 rounded overflow-hidden gap-px">
        {buckets.map(b => {
          const n = dist[b.key] ?? 0
          const w = pct(n, total)
          return w > 0 ? (
            <div key={b.key} className={`${b.color} transition-all`} style={{ width: `${w}%` }}
              title={`${b.label}: ${n} NPCs`} />
          ) : null
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {buckets.map(b => {
          const n = dist[b.key] ?? 0
          if (n === 0) return null
          return (
            <div key={b.key} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-sm ${b.color}`} />
              <span className="font-ui text-[0.6rem] text-ink-muted">{b.label}: <strong className="text-ink">{n}</strong></span>
            </div>
          )
        })}
      </div>
    </div>
  )
}


function BuildingRow({ label, avg, max, weight }: { label: string; avg: number; max: number; weight: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-ui text-xs text-ink-muted w-28 shrink-0">{label}</span>
      <div className="flex-1 space-y-0.5">
        <FillBar value={avg} max={weight} color="bg-gold/70" />
      </div>
      <span className="font-ui text-xs tabular-nums text-ink w-20 text-right shrink-0">
        <span className="text-ink-muted text-[0.6rem]">prom.</span> {avg} <span className="text-ink-muted text-[0.6rem]">máx.</span> {max}
      </span>
    </div>
  )
}

function UnitAdoptionRow({ label, withUnit, total, totalUnits, color = 'bg-gold' }: {
  label: string; withUnit: number; total: number; totalUnits: number; color?: string
}) {
  const p = pct(withUnit, total)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-ui text-xs text-ink">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="font-ui text-[0.6rem] text-ink-muted">{withUnit}/{total} NPCs</span>
          <span className="font-ui text-xs font-semibold text-ink tabular-nums">{formatResource(totalUnits)}</span>
        </div>
      </div>
      <FillBar value={withUnit} max={total} color={p > 50 ? 'bg-forest-light' : p > 10 ? color : 'bg-ink-muted/40'} />
    </div>
  )
}

function ResourceRow({ label, avg, capacity }: { label: string; avg: number; capacity: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-ui text-xs text-ink-muted w-14 shrink-0">{label}</span>
      <div className="flex-1">
        <FillBar value={avg} max={capacity} color="bg-gold/60" />
      </div>
      <span className="font-ui text-xs tabular-nums text-ink w-20 text-right shrink-0">{formatResource(avg)}</span>
    </div>
  )
}

function MissionBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`glass rounded-lg p-3 text-center ${count > 0 ? '' : 'opacity-50'}`}>
      <div className={`font-ui text-xl font-bold tabular-nums ${color}`}>{count}</div>
      <div className="font-ui text-[0.6rem] uppercase tracking-wider text-ink-muted mt-0.5">{label}</div>
    </div>
  )
}

const PAGE_SIZE = 10

function TickHistoryTable({ history }: { history: NpcTickResult[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const sorted    = [...history].reverse()
  const rows      = sorted.slice(0, visible)
  const hasMore   = visible < sorted.length
  const maxBuilt  = Math.max(...sorted.map(r => r.builtBuilding ?? 0), 1)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gold/10 font-ui text-ink-muted uppercase tracking-wider text-[0.6rem]">
              <th className="text-left py-2 px-3 whitespace-nowrap">Hora</th>
              <th className="text-right py-2 px-3">Edif.</th>
              <th className="text-right py-2 px-3">Ataque</th>
              <th className="text-right py-2 px-3">Defensa</th>
              <th className="text-right py-2 px-3">Apoyo</th>
              <th className="text-right py-2 px-3">Combates</th>
              <th className="text-right py-2 px-3">Exped.</th>
              <th className="text-right py-2 px-3 hidden sm:table-cell">Carroñ.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const built   = t.builtBuilding   ?? 0
              const combat  = t.trainedCombat   ?? 0
              const defense = t.trainedDefense  ?? 0
              const support = t.trainedSupport  ?? 0
              return (
                <tr key={t.at}
                  className={`border-b border-gold/5 transition-colors ${i === 0 ? 'bg-gold/5' : 'hover:bg-parchment-warm/5'}`}>
                  <td className="py-2 px-3 text-ink-muted tabular-nums whitespace-nowrap">
                    {formatTs(t.at)}
                    {i === 0 && <span className="ml-2 font-ui text-[0.55rem] text-gold font-semibold uppercase">último</span>}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-1">
                      <div className="h-2 rounded-sm bg-forest-light/60 hidden sm:block"
                        style={{ width: `${Math.round(built / maxBuilt * 24)}px`, minWidth: built > 0 ? '2px' : '0' }} />
                      <span className={built > 0 ? 'text-forest-light font-semibold' : 'text-ink-muted'}>{built}</span>
                    </div>
                  </td>
                  <td className={`py-2 px-3 text-right tabular-nums ${combat > 0 ? 'text-crimson-light font-semibold' : 'text-ink-muted'}`}>{combat}</td>
                  <td className={`py-2 px-3 text-right tabular-nums ${defense > 0 ? 'text-gold font-semibold' : 'text-ink-muted'}`}>{defense}</td>
                  <td className={`py-2 px-3 text-right tabular-nums ${support > 0 ? 'text-gold-light font-semibold' : 'text-ink-muted'}`}>{support}</td>
                  <td className={`py-2 px-3 text-right tabular-nums ${t.attacked > 0 ? 'text-crimson-light font-semibold' : 'text-ink-muted'}`}>{t.attacked}</td>
                  <td className={`py-2 px-3 text-right tabular-nums ${t.expeditioned > 0 ? 'text-gold font-semibold' : 'text-ink-muted'}`}>{t.expeditioned}</td>
                  <td className={`py-2 px-3 text-right tabular-nums hidden sm:table-cell ${t.scavenged > 0 ? 'text-forest-light font-semibold' : 'text-ink-muted'}`}>{t.scavenged}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <div className="text-center pt-1">
          <button
            onClick={() => setVisible(v => v + PAGE_SIZE)}
            className="btn btn-ghost text-xs px-4 py-1.5"
          >
            Cargar {Math.min(PAGE_SIZE, sorted.length - visible)} más
            <span className="ml-1.5 font-ui text-[0.6rem] text-ink-muted">
              ({visible}/{sorted.length})
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

// ── NPC Decisions card ────────────────────────────────────────────────────────

const DECISION_FILTERS = [
  { key: 'all',      label: 'Todos'       },
  { key: 'saving',   label: 'Ahorrando'   },
  { key: 'waiting',  label: 'En cola'     },
  { key: 'building', label: 'Construyendo' },
  { key: 'training', label: 'Entrenando'  },
] as const

const PERSONALITY_BADGE: Record<string, { label: string; cls: string }> = {
  economy:  { label: 'Eco', cls: 'text-forest-light bg-forest/10 border-forest/20' },
  military: { label: 'Mil', cls: 'text-crimson-light bg-crimson/10 border-crimson/20' },
  balanced: { label: 'Bal', cls: 'text-gold bg-gold/10 border-gold/20' },
}

function formatCountdown(secs: number) {
  if (secs <= 0) return 'ahora'
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function decisionColor(text: string | null) {
  if (!text) return 'text-ink-muted'
  const t = text.toLowerCase()
  if (t.startsWith('ahorrando'))   return 'text-ink-muted'
  if (t.startsWith('en cola'))     return 'text-gold'
  if (t.startsWith('entrenando'))  return 'text-crimson-light'
  if (t.startsWith('energía'))     return 'text-crimson-light'
  return 'text-forest-light'
}

function NpcDecisionsCard() {
  const [filter, setFilter] = useState<string>('all')
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'npc-decisions', filter],
    queryFn: () => adminService.getNpcDecisions(filter),
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: false,
  })

  const totals = data?.totalByFilter ?? {}
  const decisions: NpcDecision[] = data?.decisions ?? []

  return (
    <div className="card-medieval p-5 space-y-4">
      <div className="card-corner-tr" /><div className="card-corner-bl" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="section-heading">Decisiones NPC</h3>
        <span className="font-ui text-[0.6rem] text-ink-muted">refresca c/30s</span>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {DECISION_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full font-ui text-xs border transition-colors ${
              filter === f.key
                ? 'bg-gold text-parchment border-gold font-semibold'
                : 'bg-transparent text-ink-muted border-gold/20 hover:border-gold/50 hover:text-ink'
            }`}
          >
            {f.label}
            {totals[f.key] != null && (
              <span className={`ml-1.5 tabular-nums ${filter === f.key ? 'text-parchment/80' : 'text-ink-muted'}`}>
                {totals[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="skeleton h-32 rounded-lg" />
      ) : decisions.length === 0 ? (
        <p className="font-ui text-xs text-ink-muted text-center py-6">Sin NPCs en esta categoría.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gold/10 font-ui text-ink-muted uppercase tracking-wider text-[0.6rem]">
                <th className="text-left py-2 px-2">NPC</th>
                <th className="text-left py-2 px-2 hidden sm:table-cell">Coord.</th>
                <th className="text-left py-2 px-2">Decisión</th>
                <th className="text-right py-2 px-2 whitespace-nowrap">Próx. check</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map(d => {
                const pb = PERSONALITY_BADGE[d.personality] ?? PERSONALITY_BADGE.balanced
                return (
                  <tr key={d.id} className="border-b border-gold/5 hover:bg-parchment-warm/20 transition-colors">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-semibold border ${pb.cls}`}>
                          {pb.label}
                        </span>
                        <span className="font-ui text-ink font-medium truncate max-w-[90px]">{d.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-ink-muted tabular-nums hidden sm:table-cell">
                      {d.realm}:{d.region}:{d.slot}
                    </td>
                    <td className="py-2 px-2 max-w-[200px]">
                      <span className={`font-ui truncate block ${decisionColor(d.lastDecision)}`} title={d.lastDecision ?? ''}>
                        {d.lastDecision ?? <span className="text-ink-muted italic">sin decisión</span>}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-ink-muted whitespace-nowrap">
                      {d.npcNextCheck ? formatCountdown(d.secsUntilNext) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

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
        {[48, 32, 48, 32].map((h, i) => (
          <div key={i} className={`skeleton h-${h} rounded-xl`} />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="glass rounded-xl p-10 text-center">
        <p className="font-ui text-sm text-ink-muted">Sin datos. Los registros se guardan a partir del primer tick del cron.</p>
      </div>
    )
  }

  const { lastTick, tickHistory, aggregate: agg } = data

  const attackActive  = (agg.missionCounts['attack:active']       ?? 0)
  const expedActive   = (agg.missionCounts['expedition:active']    ?? 0)
                      + (agg.missionCounts['expedition:exploring'] ?? 0)
                      + (agg.missionCounts['expedition:returning'] ?? 0)
  const scavActive    = (agg.missionCounts['scavenge:active']      ?? 0)
  const totalMissions = attackActive + expedActive + scavActive

  return (
    <div className="space-y-6">

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      {lastTick
        ? <TickStatusBar tick={lastTick} now={now} />
        : (
          <div className="glass rounded-xl p-4 text-center font-ui text-xs text-ink-muted">
            Sin historial de ticks aún — se registran a partir del próximo tick del cron.
          </div>
        )
      }

      {/* ── Overview metrics ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Total NPCs"    value={agg.total}    sub={`${agg.bosses} jefe(s)`} />
        <MetricCard label="Con ejército"  value={`${pct(agg.withArmy, agg.total)}%`}
          sub={`${agg.withArmy} de ${agg.total}`}
          accent={agg.withArmy > agg.total * 0.5 ? 'text-forest-light' : 'text-gold'} />
        <MetricCard label="Ejército avg"  value={agg.avgArmy}  sub={`max ${agg.maxArmy}`} />
        <MetricCard label="Misiones act." value={totalMissions}
          sub={`${attackActive} ataques · ${expedActive} exped.`}
          accent={totalMissions > 0 ? 'text-gold' : 'text-ink'} />
      </div>

      {/* ── Buildings + Army ───────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Buildings */}
        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Edificios (avg / max)</h3>
          <div className="space-y-3">
            <BuildingRow label="Aserradero"  avg={agg.avgSawmill}  max={agg.maxBarracks + 9} weight={15} />
            <BuildingRow label="Cuartel"     avg={agg.avgBarracks} max={agg.maxBarracks}     weight={10} />
            <BuildingRow label="Academia"    avg={agg.avgAcademy}  max={agg.maxAcademy}      weight={10} />
            <BuildingRow label="Taller"      avg={agg.avgWorkshop} max={agg.maxBarracks}     weight={8}  />
          </div>
        </div>

        {/* Army distribution */}
        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Distribución del ejército</h3>
          <ArmyDistribution dist={agg.armyDistribution} total={agg.total} />
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="glass rounded p-2.5 text-center">
              <div className="font-ui text-base font-bold text-ink tabular-nums">{agg.avgArmy}</div>
              <div className="font-ui text-[0.6rem] text-ink-muted uppercase tracking-wide mt-0.5">Avg</div>
            </div>
            <div className="glass rounded p-2.5 text-center">
              <div className="font-ui text-base font-bold text-ink tabular-nums">{agg.maxArmy}</div>
              <div className="font-ui text-[0.6rem] text-ink-muted uppercase tracking-wide mt-0.5">Máx</div>
            </div>
            <div className="glass rounded p-2.5 text-center">
              <div className="font-ui text-base font-bold text-gold tabular-nums">{formatResource(agg.totalSquire)}</div>
              <div className="font-ui text-[0.6rem] text-ink-muted uppercase tracking-wide mt-0.5">Escuderos</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Combat units + Support units ───────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Combat units */}
        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Ejército de combate</h3>
          <div className="space-y-3">
            <UnitAdoptionRow label="Escudero"        withUnit={agg.withArmy}        total={agg.total} totalUnits={agg.totalSquire}       color="bg-gold/60" />
            <UnitAdoptionRow label="Caballero"       withUnit={agg.withKnight}      total={agg.total} totalUnits={agg.totalKnight}       color="bg-gold/70" />
            <UnitAdoptionRow label="Paladín"         withUnit={agg.withPaladin}     total={agg.total} totalUnits={agg.totalPaladin}      color="bg-gold" />
            <UnitAdoptionRow label="Señor de guerra" withUnit={agg.withWarlord}     total={agg.total} totalUnits={agg.totalWarlord}      color="bg-gold" />
            <UnitAdoptionRow label="Gran Caballero"  withUnit={agg.withGrandKnight} total={agg.total} totalUnits={agg.totalGrandKnight}  color="bg-forest-light" />
          </div>
        </div>

        {/* Support units adoption */}
        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Unidades de apoyo</h3>
          <div className="space-y-3">
            <UnitAdoptionRow label="Mercader"  withUnit={agg.withMerchant}  total={agg.total} totalUnits={agg.totalMerchant}  />
            <UnitAdoptionRow label="Caravana"  withUnit={agg.withCaravan}   total={agg.total} totalUnits={agg.totalCaravan}   />
            <UnitAdoptionRow label="Carroñero" withUnit={agg.withScavenger} total={agg.total} totalUnits={agg.totalScavenger} />
          </div>
          {agg.withMerchant === 0 && agg.withCaravan === 0 && agg.withScavenger === 0 && (
            <p className="font-body text-xs text-ink-muted italic pt-1">
              Los NPCs economía/equilibrado empezarán a entrenar Mercader en cuanto alcancen Cuartel lv2.
            </p>
          )}
        </div>
      </div>

      {/* ── Defenses + Resources ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Defenses */}
        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Defensas</h3>
          <div className="space-y-3">
            <UnitAdoptionRow label="Arquero"         withUnit={agg.withArcher}      total={agg.total} totalUnits={agg.totalArcher}       color="bg-gold/60" />
            <UnitAdoptionRow label="Ballestero"      withUnit={agg.withCrossbowman} total={agg.total} totalUnits={agg.totalCrossbowman}  color="bg-gold/70" />
            <UnitAdoptionRow label="Ballista"        withUnit={agg.withBallista}    total={agg.total} totalUnits={agg.totalBallista}     color="bg-gold" />
            <UnitAdoptionRow label="Trebuchet"       withUnit={agg.withTrebuchet}   total={agg.total} totalUnits={agg.totalTrebuchet}    color="bg-gold" />
            <UnitAdoptionRow label="Torre Maga"      withUnit={agg.withMageTower}   total={agg.total} totalUnits={agg.totalMageTower}    color="bg-forest-light" />
            <UnitAdoptionRow label="Muro"            withUnit={agg.withCastleWall}  total={agg.total} totalUnits={agg.totalCastleWall}   color="bg-ink-mid" />
            <UnitAdoptionRow label="Foso"            withUnit={agg.withMoat}        total={agg.total} totalUnits={agg.totalMoat}         color="bg-ink-mid" />
          </div>
        </div>

        {/* Resources */}
        <div className="card-medieval p-5 space-y-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading">Recursos (prom. por NPC)</h3>
          <div className="space-y-3">
            <ResourceRow label="Madera" avg={agg.avgWood}  capacity={50000} />
            <ResourceRow label="Piedra" avg={agg.avgStone} capacity={50000} />
            <ResourceRow label="Grano"  avg={agg.avgGrain} capacity={50000} />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="glass rounded p-2.5 text-center">
              <div className="font-ui text-sm font-bold text-ink tabular-nums">{formatResource(agg.avgWood)}</div>
              <div className="font-ui text-[0.6rem] text-ink-muted uppercase tracking-wide mt-0.5">Madera</div>
            </div>
            <div className="glass rounded p-2.5 text-center">
              <div className="font-ui text-sm font-bold text-ink tabular-nums">{formatResource(agg.avgStone)}</div>
              <div className="font-ui text-[0.6rem] text-ink-muted uppercase tracking-wide mt-0.5">Piedra</div>
            </div>
            <div className="glass rounded p-2.5 text-center">
              <div className="font-ui text-sm font-bold text-ink tabular-nums">{formatResource(agg.avgGrain)}</div>
              <div className="font-ui text-[0.6rem] text-ink-muted uppercase tracking-wide mt-0.5">Grano</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active missions ─────────────────────────────────────────────────── */}
      <div className="card-medieval p-5 space-y-3">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <h3 className="section-heading">Misiones activas</h3>
        <div className="grid grid-cols-3 gap-3">
          <MissionBadge label="Ataques en curso"    count={attackActive} color="text-crimson-light" />
          <MissionBadge label="Expediciones activas" count={expedActive}  color="text-gold" />
          <MissionBadge label="Carroñeo activo"      count={scavActive}   color="text-forest-light" />
        </div>
      </div>

      {/* ── NPC Decisions ───────────────────────────────────────────────────── */}
      <NpcDecisionsCard />

      {/* ── Tick history ────────────────────────────────────────────────────── */}
      {tickHistory.length > 0 && (
        <div className="card-medieval p-5 space-y-3">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <div className="flex items-center justify-between">
            <h3 className="section-heading">Historial de ticks</h3>
            <span className="font-ui text-[0.6rem] text-ink-muted">{tickHistory.length} entradas · refresca c/60s</span>
          </div>
          <TickHistoryTable history={tickHistory} />
        </div>
      )}

    </div>
  )
}
