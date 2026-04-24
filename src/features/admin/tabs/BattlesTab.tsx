import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { formatResource } from '@/lib/format'
import { UNIT_LABELS } from '@/lib/labels'
import type { AdminBattleLog, AdminBattlesResponse } from '../types'

type FilterType = 'all' | 'npc_vs_npc' | 'npc_vs_player' | 'player_vs_npc' | 'player_vs_player'

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all',               label: 'Todos' },
  { id: 'npc_vs_npc',       label: 'NPC vs NPC' },
  { id: 'npc_vs_player',    label: 'NPC → Jugador' },
  { id: 'player_vs_npc',    label: 'Jugador → NPC' },
  { id: 'player_vs_player', label: 'JvJ' },
]

function outcomeColor(outcome: string) {
  if (outcome === 'victory') return 'text-forest-light'
  if (outcome === 'defeat')  return 'text-crimson-light'
  return 'text-gold'
}

function outcomeLabel(outcome: string) {
  if (outcome === 'victory') return 'Victoria'
  if (outcome === 'defeat')  return 'Derrota'
  return 'Empate'
}

function roundsLabel(rounds: number, outcome: string) {
  if (rounds === 0 && outcome === 'victory') return 'Sin oposición'
  if (rounds === 0) return '0 rondas'
  return `${rounds} ronda${rounds !== 1 ? 's' : ''}`
}

function typeTag(row: AdminBattleLog) {
  if (row.attackerIsNpc && row.defenderIsNpc) return <span className="badge badge-stone text-[0.55rem]">NPC vs NPC</span>
  if (row.attackerIsNpc)  return <span className="badge badge-crimson text-[0.55rem]">NPC ataca</span>
  if (row.defenderIsNpc)  return <span className="badge badge-gold text-[0.55rem]">Jug. ataca NPC</span>
  return <span className="badge badge-forest text-[0.55rem]">JvJ</span>
}

function unitLabel(id: string) {
  return UNIT_LABELS[id] ?? id
}

function UnitList({ units, accent }: { units: Record<string, number>; accent?: string }) {
  const entries = Object.entries(units ?? {}).filter(([, n]) => n > 0)
  if (entries.length === 0) return <span className="text-ink-muted/50">—</span>
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {entries.map(([id, n]) => (
        <span key={id} className={`font-ui text-[0.6rem] tabular-nums ${accent ?? 'text-ink'}`}>
          {unitLabel(id)}: {n}
        </span>
      ))}
    </div>
  )
}

function BattleDetail({ row }: { row: AdminBattleLog }) {
  const lootTotal = (row.lootWood ?? 0) + (row.lootStone ?? 0) + (row.lootGrain ?? 0)
  return (
    <div className="mt-2 pt-2 border-t border-gold/10 grid grid-cols-2 gap-x-6 gap-y-2">
      {/* Atacante */}
      <div className="space-y-1.5">
        <p className="font-ui text-[0.55rem] uppercase tracking-widest text-ink-muted">Atacante — {row.attackerName}</p>
        <div>
          <p className="font-ui text-[0.55rem] text-ink-muted mb-0.5">Envió</p>
          <UnitList units={row.attackerForce ?? {}} />
        </div>
        <div>
          <p className="font-ui text-[0.55rem] text-ink-muted mb-0.5">Perdió</p>
          <UnitList units={row.attackerLost ?? {}} accent="text-crimson-light" />
        </div>
      </div>

      {/* Defensor */}
      <div className="space-y-1.5">
        <p className="font-ui text-[0.55rem] uppercase tracking-widest text-ink-muted">Defensor — {row.defenderName}</p>
        <div>
          <p className="font-ui text-[0.55rem] text-ink-muted mb-0.5">Tenía</p>
          <UnitList units={row.defenderForce ?? {}} />
        </div>
        <div>
          <p className="font-ui text-[0.55rem] text-ink-muted mb-0.5">Perdió</p>
          <UnitList units={row.defenderLost ?? {}} accent="text-crimson-light" />
        </div>
      </div>

      {/* Botín */}
      {lootTotal > 0 && (
        <div className="col-span-2 pt-1 border-t border-gold/8">
          <p className="font-ui text-[0.55rem] text-ink-muted mb-0.5">Botín</p>
          <div className="flex gap-4 font-ui text-[0.6rem] text-gold tabular-nums">
            {row.lootWood  > 0 && <span>Madera: {formatResource(row.lootWood)}</span>}
            {row.lootStone > 0 && <span>Piedra: {formatResource(row.lootStone)}</span>}
            {row.lootGrain > 0 && <span>Grano: {formatResource(row.lootGrain)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="glass rounded-xl p-4 space-y-1">
      <p className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted">{label}</p>
      <p className={`font-ui text-2xl font-bold tabular-nums ${accent ?? 'text-ink'}`}>{value}</p>
      {sub && <p className="font-ui text-[0.6rem] text-ink-muted">{sub}</p>}
    </div>
  )
}

function MetricsRow({ metrics }: { metrics: AdminBattlesResponse['metrics'] }) {
  const loot = (metrics.totalLoot24h.wood ?? 0) + (metrics.totalLoot24h.stone ?? 0) + (metrics.totalLoot24h.grain ?? 0)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MetricCard label="Combates (24h)" value={metrics.total24h} />
      <MetricCard label="NPC → Jugador"  value={metrics.npcVsPlayer24h}    accent={metrics.npcVsPlayer24h    > 0 ? 'text-crimson-light' : 'text-ink'} />
      <MetricCard label="Jugador → NPC"  value={metrics.playerVsNpc24h}    accent={metrics.playerVsNpc24h    > 0 ? 'text-gold'          : 'text-ink'} />
      <MetricCard label="Botín total"    value={formatResource(loot)}       accent={loot > 0                 ? 'text-gold'          : 'text-ink'} sub="madera + piedra + grano" />
    </div>
  )
}

function BattleRow({ row }: { row: AdminBattleLog }) {
  const [open, setOpen] = useState(false)
  const lootTotal = (row.lootWood ?? 0) + (row.lootStone ?? 0) + (row.lootGrain ?? 0)
  const hasDetail = Object.keys(row.attackerForce ?? {}).length > 0 || Object.keys(row.defenderForce ?? {}).length > 0

  return (
    <div
      className={`py-3 border-b border-gold/8 last:border-0 px-4 -mx-4 rounded transition-colors ${hasDetail ? 'cursor-pointer hover:bg-parchment-warm/30' : ''}`}
      onClick={() => hasDetail && setOpen(o => !o)}
    >
      <div className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] items-center gap-x-4">
        {/* Fecha + tipo */}
        <div className="space-y-1 min-w-[80px]">
          <p className="font-ui text-[0.6rem] text-ink-muted tabular-nums whitespace-nowrap">
            {new Date(row.createdAt).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          {typeTag(row)}
        </div>

        {/* Atacante */}
        <div className="min-w-0">
          <p className="font-ui text-xs font-semibold text-ink truncate">{row.attackerName}</p>
          <p className="font-ui text-[0.6rem] text-ink-muted">{row.attackerCoord}</p>
        </div>

        {/* Defensor */}
        <div className="min-w-0">
          <p className="font-ui text-xs font-semibold text-ink truncate">{row.defenderName}</p>
          <p className="font-ui text-[0.6rem] text-ink-muted">{row.defenderCoord}</p>
        </div>

        {/* Resultado */}
        <div className="text-center">
          <p className={`font-ui text-xs font-bold ${outcomeColor(row.outcome)}`}>{outcomeLabel(row.outcome)}</p>
          <p className="font-ui text-[0.6rem] text-ink-muted">{roundsLabel(row.rounds, row.outcome)}</p>
        </div>

        {/* Bajas */}
        <div className="text-right space-y-0.5">
          <p className="font-ui text-[0.6rem] text-ink-muted">Bajas</p>
          <p className="font-ui text-xs tabular-nums text-crimson-light">
            {row.attackerLosses > 0 ? `Atk −${row.attackerLosses}` : '—'}
          </p>
          <p className="font-ui text-xs tabular-nums text-crimson-light/70">
            {row.defenderLosses > 0 ? `Def −${row.defenderLosses}` : '—'}
          </p>
        </div>

        {/* Botín + expand */}
        <div className="text-right min-w-[56px]">
          <p className="font-ui text-[0.6rem] text-ink-muted">Botín</p>
          <p className={`font-ui text-xs font-semibold tabular-nums ${lootTotal > 0 ? 'text-gold' : 'text-ink-muted/40'}`}>
            {lootTotal > 0 ? formatResource(lootTotal) : '—'}
          </p>
          {hasDetail && (
            <p className="font-ui text-[0.5rem] text-ink-muted/50 mt-0.5">{open ? '▲ ocultar' : '▼ detalle'}</p>
          )}
        </div>
      </div>

      {open && hasDetail && <BattleDetail row={row} />}
    </div>
  )
}

export function BattlesTab() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage]     = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'battles', filter, page],
    queryFn: () => adminService.getBattles({ type: filter, page }),
    refetchInterval: 5_000,
  })

  return (
    <div className="space-y-5">

      {/* Metrics */}
      {data?.metrics && <MetricsRow metrics={data.metrics} />}

      {/* Filters + list */}
      <div className="card-medieval p-5 space-y-4">
        <div className="card-corner-tr" /><div className="card-corner-bl" />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="section-heading">Registro de combates</h3>
          <div className="flex gap-1 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => { setFilter(f.id); setPage(1) }}
                className={`px-3 py-1 rounded font-ui text-[0.65rem] font-semibold uppercase tracking-wider transition-colors
                  ${filter === f.id
                    ? 'bg-gold/20 text-gold border border-gold/30'
                    : 'text-ink-muted hover:text-ink border border-transparent hover:border-gold/20'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
          </div>
        ) : !data?.battles.length ? (
          <p className="font-ui text-sm text-ink-muted text-center py-10">Sin combates registrados con este filtro.</p>
        ) : (
          <div>
            {data.battles.map(row => <BattleRow key={row.id} row={row} />)}
          </div>
        )}

        {data && data.battles.length === data.limit && (
          <div className="flex items-center justify-between pt-2 border-t border-gold/10">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
            >
              ← Anterior
            </button>
            <span className="font-ui text-xs text-ink-muted">Página {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              className="btn btn-ghost text-xs px-3 py-1.5"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
