import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TreePine, Mountain, Wheat } from 'lucide-react'
import { adminService } from '../services/adminService'
import { formatResource } from '@/lib/format'
import type { AdminBattleLog } from '../types'

type FilterType = 'all' | 'npc_vs_npc' | 'npc_vs_player' | 'player_vs_npc' | 'player_vs_player'

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all',              label: 'Todos' },
  { id: 'npc_vs_npc',      label: 'NPC vs NPC' },
  { id: 'npc_vs_player',   label: 'NPC → Jugador' },
  { id: 'player_vs_npc',   label: 'Jugador → NPC' },
  { id: 'player_vs_player', label: 'Jugador vs Jugador' },
]

function outcomeLabel(outcome: string, isAttacker = true) {
  if (outcome === 'victory') return isAttacker ? '⚔️ Victoria' : '💀 Derrota'
  if (outcome === 'defeat')  return isAttacker ? '💀 Derrota'  : '⚔️ Victoria'
  return '🤝 Empate'
}

function outcomeColor(outcome: string) {
  if (outcome === 'victory') return 'text-forest-light'
  if (outcome === 'defeat')  return 'text-crimson-light'
  return 'text-gold'
}

function typeTag(row: AdminBattleLog) {
  if (row.attackerIsNpc && row.defenderIsNpc) return <span className="badge badge-stone">NPC vs NPC</span>
  if (row.attackerIsNpc)  return <span className="badge badge-crimson">NPC ataca</span>
  if (row.defenderIsNpc)  return <span className="badge badge-gold">Jugador ataca</span>
  return <span className="badge badge-forest">JvJ</span>
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass rounded-lg p-3 text-center">
      <div className="font-ui text-xl font-bold text-parchment tabular-nums">{value}</div>
      <div className="font-ui text-[0.65rem] text-parchment-dim uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  )
}

export function BattlesTab() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage]     = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'battles', filter, page],
    queryFn: () => adminService.getBattles({ type: filter, page }),
    refetchInterval: 30_000,
  })

  const m = data?.metrics

  return (
    <div className="space-y-5">
      {/* Metrics — last 24h */}
      {m && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <MetricCard label="Total 24h" value={m.total24h} />
          <MetricCard label="NPC vs NPC" value={m.npcVsNpc24h} />
          <MetricCard label="NPC → Jugador" value={m.npcVsPlayer24h} />
          <MetricCard label="Jugador → NPC" value={m.playerVsNpc24h} />
          <MetricCard label="JvJ" value={m.playerVsPlayer24h} />
          <div className="glass rounded-lg p-3 text-center col-span-2 sm:col-span-1 lg:col-span-1">
            <div className="font-ui text-xs font-bold text-parchment leading-tight">
              <span className="flex items-center justify-center gap-1">
                <TreePine size={10} className="text-forest-light" /> {formatResource(m.totalLoot24h.wood)}
              </span>
              <span className="flex items-center justify-center gap-1">
                <Mountain size={10} className="text-parchment-dim" /> {formatResource(m.totalLoot24h.stone)}
              </span>
              <span className="flex items-center justify-center gap-1">
                <Wheat size={10} className="text-gold" /> {formatResource(m.totalLoot24h.grain)}
              </span>
            </div>
            <div className="font-ui text-[0.65rem] text-parchment-dim uppercase tracking-widest mt-0.5">Botín 24h</div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setPage(1) }}
            className={`px-3 py-1.5 rounded font-ui text-xs font-semibold uppercase tracking-wider transition-colors
              ${filter === f.id ? 'bg-gold/20 text-gold border border-gold/30' : 'text-ink-muted hover:text-ink hover:bg-parchment-warm/5 border border-transparent'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded" />
          ))}
        </div>
      ) : !data?.battles.length ? (
        <p className="font-ui text-sm text-parchment-dim text-center py-8">Sin combates registrados aún.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-ui text-xs">
            <thead>
              <tr className="border-b border-gold/10 text-parchment-dim uppercase tracking-wider">
                <th className="text-left py-2 px-2">Fecha</th>
                <th className="text-left py-2 px-2">Tipo</th>
                <th className="text-left py-2 px-2">Atacante</th>
                <th className="text-left py-2 px-2">Defensor</th>
                <th className="text-center py-2 px-2">Resultado</th>
                <th className="text-right py-2 px-2">Bajas Atk</th>
                <th className="text-right py-2 px-2">Bajas Def</th>
                <th className="text-right py-2 px-2">Botín</th>
              </tr>
            </thead>
            <tbody>
              {data.battles.map(row => {
                const lootTotal = (row.lootWood ?? 0) + (row.lootStone ?? 0) + (row.lootGrain ?? 0)
                return (
                  <tr key={row.id} className="border-b border-gold/5 hover:bg-parchment-warm/3 transition-colors">
                    <td className="py-2 px-2 text-parchment-dim whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 px-2">{typeTag(row)}</td>
                    <td className="py-2 px-2">
                      <div className="text-parchment font-semibold">{row.attackerName}</div>
                      <div className="text-parchment-dim text-[0.6rem]">{row.attackerCoord}</div>
                    </td>
                    <td className="py-2 px-2">
                      <div className="text-parchment font-semibold">{row.defenderName}</div>
                      <div className="text-parchment-dim text-[0.6rem]">{row.defenderCoord}</div>
                    </td>
                    <td className={`py-2 px-2 text-center font-bold ${outcomeColor(row.outcome)}`}>
                      {outcomeLabel(row.outcome)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-crimson-light">
                      {row.attackerLosses > 0 ? `-${row.attackerLosses}` : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-crimson-light">
                      {row.defenderLosses > 0 ? `-${row.defenderLosses}` : '—'}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums text-gold">
                      {lootTotal > 0 ? formatResource(lootTotal) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.battles.length === data.limit && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-ghost text-xs px-3 py-1.5 disabled:opacity-30"
          >
            ← Anterior
          </button>
          <span className="font-ui text-xs text-parchment-dim">Página {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            className="btn btn-ghost text-xs px-3 py-1.5"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
