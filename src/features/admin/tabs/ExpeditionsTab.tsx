import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { formatResource, formatDuration } from '@/lib/format'
import type { AdminExpedition } from '../types'

const OUTCOME_LABEL: Record<string, string> = {
  resources:  '💰 Recursos',
  units:      '⚔️ Unidades',
  nothing:    '🌑 Nada',
  black_hole: '🌀 Agujero negro',
  delay:      '⏳ Retraso',
  speedup:    '⚡ Aceleración',
  bandits:    '⚔️ Merodeadores',
  demons:     '⚔️ Bestias Oscuras',
  merchant:   '🛒 Mercader',
  ether:      '✨ Éter',
}

const OUTCOME_COLOR: Record<string, string> = {
  resources:  'text-gold',
  units:      'text-forest-light',
  ether:      'text-gold-light',
  bandits:    'text-crimson-light',
  demons:     'text-crimson-light',
  black_hole: 'text-crimson-light',
  delay:      'text-ink-muted',
  speedup:    'text-forest-light',
  merchant:   'text-gold',
  nothing:    'text-ink-muted',
}

function stateColor(state: string) {
  if (state === 'active')    return 'text-gold'
  if (state === 'exploring') return 'text-forest-light'
  if (state === 'returning') return 'text-ink-mid'
  return 'text-ink-muted'
}

function stateLabel(state: string) {
  if (state === 'active')    return 'En camino'
  if (state === 'exploring') return 'Explorando'
  if (state === 'returning') return 'Regresando'
  if (state === 'completed') return 'Completada'
  return state
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleString('es-ES', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const TH = 'text-left py-2 px-2 font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted whitespace-nowrap'
const TD = 'py-2 px-2 font-ui text-xs whitespace-nowrap'

// ── Active expeditions table ──────────────────────────────────────────────────

function ActiveTable({ missions, now }: { missions: AdminExpedition[]; now: number }) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gold/20">
            <th className={TH}>Reino</th>
            <th className={`${TH} text-center`}>Estado</th>
            <th className={`${TH} text-right`}>Tiempo</th>
            <th className={`${TH} text-center`}>Resultado</th>
            <th className={`${TH} text-right`}>Botín</th>
          </tr>
        </thead>
        <tbody>
          {missions.map(m => {
            const outcome = m.result ? (m.result as Record<string, unknown>).outcome as string : null
            const loot    = (m.woodLoad ?? 0) + (m.stoneLoad ?? 0) + (m.grainLoad ?? 0)

            let timeLeft: number | null = null
            if (m.state === 'returning' && m.returnTime && m.returnTime > now) {
              timeLeft = m.returnTime - now
            } else if (m.state === 'active' && m.arrivalTime > now) {
              timeLeft = m.arrivalTime - now
            } else if (m.state === 'exploring') {
              const holdUntil = m.arrivalTime + (m.holdingTime ?? 0)
              if (holdUntil > now) timeLeft = holdUntil - now
            }

            return (
              <tr key={m.id} className="border-b border-gold/8 last:border-0 hover:bg-parchment-warm/30 transition-colors">
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{m.kingdomName}</span>
                    {m.isNpc && <span className="badge badge-stone text-[0.55rem]">NPC</span>}
                  </div>
                  <p className="text-[0.6rem] text-ink-muted mt-0.5">{m.startRealm}:{m.startRegion}:{m.startSlot} → {m.targetRealm}:{m.targetRegion}:16</p>
                </td>
                <td className={`${TD} text-center`}>
                  <span className={`font-semibold ${stateColor(m.state)}`}>{stateLabel(m.state)}</span>
                </td>
                <td className={`${TD} text-right tabular-nums text-ink-muted`}>
                  {timeLeft !== null ? formatDuration(timeLeft) : '—'}
                </td>
                <td className={`${TD} text-center`}>
                  {outcome
                    ? <span className={`font-semibold ${OUTCOME_COLOR[outcome] ?? 'text-ink-mid'}`}>{OUTCOME_LABEL[outcome] ?? outcome}</span>
                    : <span className="text-ink-muted/40">—</span>
                  }
                </td>
                <td className={`${TD} text-right tabular-nums font-semibold ${loot > 0 ? 'text-gold' : 'text-ink-muted/40'}`}>
                  {loot > 0 ? formatResource(loot) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Completed expeditions table ───────────────────────────────────────────────

function CompletedTable({ missions }: { missions: AdminExpedition[] }) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gold/20">
            <th className={TH}>Reino · Fecha</th>
            <th className={`${TH} text-center`}>Destino</th>
            <th className={`${TH} text-center`}>Resultado</th>
            <th className={`${TH} text-right`}>Botín</th>
          </tr>
        </thead>
        <tbody>
          {missions.map(m => {
            const outcome     = m.result ? (m.result as Record<string, unknown>).outcome as string : null
            const result      = m.result as Record<string, unknown> | null
            const loot        = (m.woodLoad ?? 0) + (m.stoneLoad ?? 0) + (m.grainLoad ?? 0)
            const etherGained = result?.etherGained as number | undefined

            return (
              <tr key={m.id} className="border-b border-gold/8 last:border-0 hover:bg-parchment-warm/30 transition-colors">
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{m.kingdomName}</span>
                    {m.isNpc && <span className="badge badge-stone text-[0.55rem]">NPC</span>}
                  </div>
                  <p className="text-[0.6rem] text-ink-muted mt-0.5">{formatDate(m.departureTime)}</p>
                </td>
                <td className={`${TD} text-center text-ink-muted text-[0.6rem]`}>
                  {m.targetRealm}:{m.targetRegion}:16
                </td>
                <td className={`${TD} text-center`}>
                  {outcome
                    ? <span className={`font-semibold ${OUTCOME_COLOR[outcome] ?? 'text-ink-mid'}`}>{OUTCOME_LABEL[outcome] ?? outcome}</span>
                    : <span className="text-ink-muted/40">—</span>
                  }
                </td>
                <td className={`${TD} text-right`}>
                  {loot > 0
                    ? <span className="font-semibold tabular-nums text-gold" title={`Madera: ${m.woodLoad ?? 0}  Piedra: ${m.stoneLoad ?? 0}  Grano: ${m.grainLoad ?? 0}`}>{formatResource(loot)}</span>
                    : etherGained
                    ? <span className="font-semibold text-gold-light">✨{etherGained}</span>
                    : <span className="text-ink-muted/40">—</span>
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const PAGE_SIZE = 10

function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null
  return (
    <div className="flex items-center justify-between pt-2 border-t border-gold/10">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        className="btn btn-ghost text-xs px-3 py-1.5 disabled:opacity-30">← Anterior</button>
      <span className="font-ui text-xs text-ink-muted">Página {page} / {total}</span>
      <button onClick={() => onChange(Math.min(total, page + 1))} disabled={page === total}
        className="btn btn-ghost text-xs px-3 py-1.5 disabled:opacity-30">Siguiente →</button>
    </div>
  )
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export function ExpeditionsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'expeditions'],
    queryFn: adminService.getExpeditions,
    refetchInterval: 5_000,
  })

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [completedPage, setCompletedPage] = useState(1)
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const { depletion, active, recent } = data ?? {}
  const totalCompletedPages = Math.ceil((recent?.length ?? 0) / PAGE_SIZE)
  const pagedRecent = (recent ?? []).slice((completedPage - 1) * PAGE_SIZE, completedPage * PAGE_SIZE)

  const recentStats = recent?.reduce((acc, m) => {
    const outcome = m.result ? (m.result as Record<string, unknown>).outcome as string : 'nothing'
    acc[outcome] = (acc[outcome] ?? 0) + 1
    acc._total++
    acc._loot += (m.woodLoad ?? 0) + (m.stoneLoad ?? 0) + (m.grainLoad ?? 0)
    return acc
  }, { _total: 0, _loot: 0 } as Record<string, number>) ?? { _total: 0, _loot: 0 }

  return (
    <div className="space-y-5">

      {/* Depletion map */}
      {depletion && Object.keys(depletion).length > 0 && (
        <div className="card-medieval p-4">
          <div className="card-corner-tr" /><div className="card-corner-bl" />
          <h3 className="section-heading mb-2.5">Depleción por región (24h)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1.5">
            {Object.entries(depletion)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([key, d]) => (
                <div key={key} className="glass rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-1.5">
                  <span className="font-ui text-[0.65rem] font-semibold text-ink truncate">{key}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-ui text-[0.55rem] text-ink-muted">{d.count}×</span>
                    <span className={`font-ui text-[0.65rem] font-bold tabular-nums ${d.factor < 0.7 ? 'text-crimson-light' : d.factor < 1 ? 'text-gold' : 'text-forest-light'}`}>
                      ×{d.factor.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Active */}
      <div className="card-medieval p-5 space-y-3">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <div className="flex items-center justify-between">
          <h3 className="section-heading">En curso</h3>
          <span className="font-ui text-xs text-ink-muted">{active?.length ?? 0} expediciones</span>
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
        ) : !active?.length ? (
          <p className="font-ui text-sm text-ink-muted text-center py-8">Sin expediciones activas.</p>
        ) : (
          <ActiveTable missions={active} now={now} />
        )}
      </div>

      {/* Completed */}
      <div className="card-medieval p-5 space-y-3">
        <div className="card-corner-tr" /><div className="card-corner-bl" />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="section-heading">Últimos 7 días</h3>
            <p className="font-ui text-[0.6rem] text-ink-muted mt-0.5">{recentStats._total} expediciones completadas</p>
          </div>
          {recentStats._total > 0 && (
            <div className="flex gap-3 flex-wrap">
              {Object.entries(recentStats)
                .filter(([k]) => !k.startsWith('_') && (recentStats[k] as number) > 0)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([outcome, count]) => (
                  <div key={outcome} className="glass rounded-lg px-2.5 py-1.5 text-center">
                    <p className={`font-ui text-xs font-semibold ${OUTCOME_COLOR[outcome] ?? 'text-ink-muted'}`}>
                      {OUTCOME_LABEL[outcome] ?? outcome}
                    </p>
                    <p className="font-ui text-[0.6rem] text-ink-muted">×{count}</p>
                  </div>
                ))}
              {recentStats._loot > 0 && (
                <div className="glass rounded-lg px-2.5 py-1.5 text-center">
                  <p className="font-ui text-xs font-semibold text-gold">{formatResource(recentStats._loot)}</p>
                  <p className="font-ui text-[0.6rem] text-ink-muted">botín total</p>
                </div>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
        ) : !recent?.length ? (
          <p className="font-ui text-sm text-ink-muted text-center py-8">
            Sin expediciones completadas en los últimos 7 días.
          </p>
        ) : (
          <>
            <CompletedTable missions={pagedRecent} />
            <Pager page={completedPage} total={totalCompletedPages} onChange={setCompletedPage} />
          </>
        )}
      </div>

    </div>
  )
}
