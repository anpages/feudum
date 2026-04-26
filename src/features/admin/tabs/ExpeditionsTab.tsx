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

// ── Active expedition row ─────────────────────────────────────────────────────

function ActiveRow({ m, now }: { m: AdminExpedition; now: number }) {
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
    <div className="py-3 border-b border-gold/8 last:border-0 hover:bg-parchment-warm/30 transition-colors px-4 -mx-4 rounded">
      {/* ── Mobile ── */}
      <div className="sm:hidden space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-ui text-xs font-semibold text-ink truncate">{m.kingdomName}</p>
            {m.isNpc && <span className="badge badge-stone text-[0.55rem] shrink-0">NPC</span>}
          </div>
          <p className={`font-ui text-xs font-semibold shrink-0 ${stateColor(m.state)}`}>{stateLabel(m.state)}</p>
        </div>
        <div className="flex items-center justify-between gap-2 text-[0.6rem] font-ui text-ink-muted">
          <span>{m.startRealm}:{m.startRegion}:{m.startSlot} → {m.targetRealm}:{m.targetRegion}:16</span>
          <span className="tabular-nums">{timeLeft !== null ? formatDuration(timeLeft) : '—'}</span>
        </div>
        {(outcome || loot > 0) && (
          <div className="flex items-center justify-between gap-2">
            {outcome
              ? <p className={`font-ui text-[0.6rem] font-semibold ${OUTCOME_COLOR[outcome] ?? 'text-ink-mid'}`}>{OUTCOME_LABEL[outcome] ?? outcome}</p>
              : <span />
            }
            {loot > 0 && <p className="font-ui text-[0.6rem] font-semibold tabular-nums text-gold">{formatResource(loot)}</p>}
          </div>
        )}
      </div>

      {/* ── Desktop ── */}
      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-ui text-xs font-semibold text-ink truncate">{m.kingdomName}</p>
            {m.isNpc && <span className="badge badge-stone text-[0.55rem] shrink-0">NPC</span>}
          </div>
          <p className="font-ui text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot} → {m.targetRealm}:{m.targetRegion}:16</p>
        </div>
        <div className="text-center min-w-[72px]">
          <p className={`font-ui text-xs font-semibold ${stateColor(m.state)}`}>{stateLabel(m.state)}</p>
        </div>
        <div className="text-right min-w-[60px]">
          <p className="font-ui text-xs tabular-nums text-ink-muted">{timeLeft !== null ? formatDuration(timeLeft) : '—'}</p>
        </div>
        <div className="text-center min-w-[100px]">
          {outcome
            ? <p className={`font-ui text-xs font-semibold ${OUTCOME_COLOR[outcome] ?? 'text-ink-mid'}`}>{OUTCOME_LABEL[outcome] ?? outcome}</p>
            : <p className="font-ui text-xs text-ink-muted/40">—</p>
          }
        </div>
        <div className="text-right min-w-[56px]">
          <p className={`font-ui text-xs font-semibold tabular-nums ${loot > 0 ? 'text-gold' : 'text-ink-muted/40'}`}>
            {loot > 0 ? formatResource(loot) : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Completed expedition row ──────────────────────────────────────────────────

function CompletedRow({ m }: { m: AdminExpedition }) {
  const outcome     = m.result ? (m.result as Record<string, unknown>).outcome as string : null
  const result      = m.result as Record<string, unknown> | null
  const loot        = (m.woodLoad ?? 0) + (m.stoneLoad ?? 0) + (m.grainLoad ?? 0)
  const etherGained = result?.etherGained as number | undefined

  const lootNode = loot > 0
    ? <p className="font-ui text-xs font-semibold tabular-nums text-gold" title={`Madera: ${m.woodLoad ?? 0}  Piedra: ${m.stoneLoad ?? 0}  Grano: ${m.grainLoad ?? 0}`}>{formatResource(loot)}</p>
    : etherGained
    ? <p className="font-ui text-xs font-semibold text-gold-light">✨{etherGained}</p>
    : <p className="font-ui text-xs text-ink-muted/40">—</p>

  return (
    <div className="py-3 border-b border-gold/8 last:border-0 hover:bg-parchment-warm/30 transition-colors px-4 -mx-4 rounded">
      {/* ── Mobile ── */}
      <div className="sm:hidden space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-ui text-xs font-semibold text-ink truncate">{m.kingdomName}</p>
            {m.isNpc && <span className="badge badge-stone text-[0.55rem] shrink-0">NPC</span>}
          </div>
          {outcome
            ? <p className={`font-ui text-[0.6rem] font-semibold shrink-0 ${OUTCOME_COLOR[outcome] ?? 'text-ink-mid'}`}>{OUTCOME_LABEL[outcome] ?? outcome}</p>
            : null
          }
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-ui text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot} · {formatDate(m.departureTime)}</p>
          {lootNode}
        </div>
      </div>

      {/* ── Desktop ── */}
      <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-ui text-xs font-semibold text-ink truncate">{m.kingdomName}</p>
            {m.isNpc && <span className="badge badge-stone text-[0.55rem] shrink-0">NPC</span>}
          </div>
          <p className="font-ui text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot} · {formatDate(m.departureTime)}</p>
        </div>
        <div className="text-center min-w-[60px]">
          <p className="font-ui text-[0.6rem] text-ink-muted">{m.targetRealm}:{m.targetRegion}:16</p>
        </div>
        <div className="text-center min-w-[110px]">
          {outcome
            ? <p className={`font-ui text-xs font-semibold ${OUTCOME_COLOR[outcome] ?? 'text-ink-mid'}`}>{OUTCOME_LABEL[outcome] ?? outcome}</p>
            : <p className="font-ui text-xs text-ink-muted/40">—</p>
          }
        </div>
        <div className="text-right min-w-[64px]">{lootNode}</div>
      </div>
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
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const { depletion, active, recent } = data ?? {}

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
          <div>
            {/* Column headers — desktop only */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 pb-2 border-b border-gold/10 px-4 -mx-4">
              <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted">Reino</span>
              <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted text-center min-w-[72px]">Estado</span>
              <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted text-right min-w-[60px]">Tiempo</span>
              <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted text-center min-w-[100px]">Resultado</span>
              <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted text-right min-w-[56px]">Botín</span>
            </div>
            {active.map(m => <ActiveRow key={m.id} m={m} now={now} />)}
          </div>
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
          <div>
            {/* Column headers — desktop only */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-x-4 pb-2 border-b border-gold/10 px-4 -mx-4">
              <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted">Reino</span>
              <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted text-center min-w-[60px]">Destino</span>
              <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted text-center min-w-[110px]">Resultado</span>
              <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted text-right min-w-[64px]">Botín</span>
            </div>
            {recent.map(m => <CompletedRow key={m.id} m={m} />)}
          </div>
        )}
      </div>

    </div>
  )
}
