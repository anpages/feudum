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
  resources: 'text-gold',
  units:     'text-forest-light',
  ether:     'text-gold-light',
  bandits:   'text-crimson-light',
  demons:    'text-crimson-light',
  black_hole:'text-crimson-light',
  delay:     'text-ink-muted',
  speedup:   'text-forest-light',
  merchant:  'text-gold',
  nothing:   'text-ink-muted',
}

function stateColor(state: string) {
  if (state === 'active')    return 'text-gold'
  if (state === 'exploring') return 'text-forest-light'
  if (state === 'returning') return 'text-ink-mid'
  if (state === 'completed') return 'text-ink-muted'
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

// ── Active row (with countdown) ───────────────────────────────────────────────

function ActiveRow({ m, now }: { m: AdminExpedition; now: number }) {
  const outcome = m.result ? (m.result as Record<string, unknown>).outcome as string : null
  const loot    = (m.woodLoad ?? 0) + (m.stoneLoad ?? 0) + (m.grainLoad ?? 0)

  const timeLeft = m.state === 'returning' && m.returnTime && m.returnTime > now
    ? m.returnTime - now
    : m.state !== 'completed' && m.arrivalTime > now
    ? m.arrivalTime - now
    : null

  return (
    <tr className="border-b border-gold/5 hover:bg-parchment-warm/3 transition-colors">
      <td className="py-2 px-2">
        <div className="font-ui text-xs font-semibold text-ink">{m.kingdomName}</div>
        <div className="font-ui text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot}</div>
        {m.isNpc && <span className="badge badge-stone text-[0.55rem] px-1 py-0">NPC</span>}
      </td>
      <td className="py-2 px-2 text-center font-ui text-xs text-gold-dim">
        {m.targetRealm}:{m.targetRegion}:16
      </td>
      <td className={`py-2 px-2 text-center font-ui text-xs font-semibold ${stateColor(m.state)}`}>
        {stateLabel(m.state)}
      </td>
      <td className="py-2 px-2 text-right font-ui text-xs text-ink-muted tabular-nums">
        {timeLeft !== null ? formatDuration(timeLeft) : '—'}
      </td>
      <td className={`py-2 px-2 text-center font-ui text-xs font-semibold ${outcome ? (OUTCOME_COLOR[outcome] ?? 'text-ink-mid') : 'text-ink-muted'}`}>
        {outcome ? (OUTCOME_LABEL[outcome] ?? outcome) : '—'}
      </td>
      <td className="py-2 px-2 text-right font-ui text-xs text-gold tabular-nums">
        {loot > 0 ? formatResource(loot) : '—'}
      </td>
    </tr>
  )
}

// ── Completed row (with date + full result breakdown) ─────────────────────────

function CompletedRow({ m }: { m: AdminExpedition }) {
  const outcome = m.result ? (m.result as Record<string, unknown>).outcome as string : null
  const result  = m.result as Record<string, unknown> | null
  const loot    = (m.woodLoad ?? 0) + (m.stoneLoad ?? 0) + (m.grainLoad ?? 0)
  const etherGained = result?.etherGained as number | undefined

  return (
    <tr className="border-b border-gold/5 hover:bg-parchment-warm/3 transition-colors">
      <td className="py-2 px-2">
        <div className="font-ui text-xs font-semibold text-ink">{m.kingdomName}</div>
        <div className="font-ui text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot}</div>
        {m.isNpc && <span className="badge badge-stone text-[0.55rem] px-1 py-0">NPC</span>}
      </td>
      <td className="py-2 px-2 text-center font-ui text-xs text-gold-dim">
        {m.targetRealm}:{m.targetRegion}:16
      </td>
      <td className="py-2 px-2 text-center font-ui text-[0.6rem] text-ink-muted tabular-nums">
        {formatDate(m.departureTime)}
      </td>
      <td className={`py-2 px-2 text-center font-ui text-xs font-semibold ${outcome ? (OUTCOME_COLOR[outcome] ?? 'text-ink-mid') : 'text-ink-muted'}`}>
        {outcome ? (OUTCOME_LABEL[outcome] ?? outcome) : '—'}
      </td>
      <td className="py-2 px-2 text-right font-ui text-xs text-gold tabular-nums">
        {loot > 0 ? (
          <span title={`Madera: ${m.woodLoad ?? 0}  Piedra: ${m.stoneLoad ?? 0}  Grano: ${m.grainLoad ?? 0}`}>
            {formatResource(loot)}
          </span>
        ) : etherGained ? (
          <span className="text-gold-light">✨{etherGained}</span>
        ) : '—'}
      </td>
    </tr>
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

  // Aggregate recent stats
  const recentStats = recent?.reduce((acc, m) => {
    const outcome = m.result ? (m.result as Record<string, unknown>).outcome as string : 'nothing'
    acc[outcome] = (acc[outcome] ?? 0) + 1
    acc._total++
    acc._loot += (m.woodLoad ?? 0) + (m.stoneLoad ?? 0) + (m.grainLoad ?? 0)
    return acc
  }, { _total: 0, _loot: 0 } as Record<string, number>) ?? { _total: 0, _loot: 0 }

  return (
    <div className="space-y-6">

      {/* Depletion map */}
      {depletion && Object.keys(depletion).length > 0 && (
        <div>
          <h3 className="font-ui text-xs font-semibold uppercase tracking-widest text-ink-muted mb-2">Depleción por región (24h)</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(depletion)
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([key, d]) => (
                <div key={key} className="glass rounded px-3 py-1.5 flex items-center gap-2">
                  <span className="font-ui text-xs font-semibold text-ink">{key}</span>
                  <span className="font-ui text-xs text-ink-muted">{d.count}×</span>
                  <span className={`font-ui text-xs font-bold ${d.factor < 0.7 ? 'text-crimson-light' : d.factor < 1 ? 'text-gold' : 'text-forest-light'}`}>
                    ×{d.factor.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Active + exploring + returning */}
      <div>
        <h3 className="font-ui text-xs font-semibold uppercase tracking-widest text-ink-muted mb-2">
          En curso ({active?.length ?? 0})
        </h3>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}</div>
        ) : !active?.length ? (
          <p className="font-ui text-sm text-ink-muted text-center py-6">Sin expediciones activas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-ui text-xs">
              <thead>
                <tr className="border-b border-gold/10 text-ink-muted uppercase tracking-wider text-[0.6rem]">
                  <th className="text-left py-2 px-2">Reino</th>
                  <th className="text-center py-2 px-2">Destino</th>
                  <th className="text-center py-2 px-2">Estado</th>
                  <th className="text-right py-2 px-2">Tiempo</th>
                  <th className="text-center py-2 px-2">Resultado</th>
                  <th className="text-right py-2 px-2">Botín</th>
                </tr>
              </thead>
              <tbody>
                {active.map(m => <ActiveRow key={m.id} m={m} now={now} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completed history */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-ui text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Completadas — últimos 7 días ({recentStats._total})
          </h3>
          {recentStats._total > 0 && (
            <div className="flex gap-3 flex-wrap justify-end">
              {Object.entries(recentStats)
                .filter(([k]) => !k.startsWith('_') && (recentStats[k] as number) > 0)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([outcome, count]) => (
                  <span key={outcome} className={`font-ui text-[0.6rem] ${OUTCOME_COLOR[outcome] ?? 'text-ink-muted'}`}>
                    {OUTCOME_LABEL[outcome] ?? outcome} ×{count}
                  </span>
                ))}
              {recentStats._loot > 0 && (
                <span className="font-ui text-[0.6rem] text-gold">
                  Botín total: {formatResource(recentStats._loot)}
                </span>
              )}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}</div>
        ) : !recent?.length ? (
          <p className="font-ui text-sm text-ink-muted text-center py-6">
            Sin expediciones completadas en los últimos 7 días.{' '}
            <span className="opacity-60">(Los registros se guardan a partir de ahora.)</span>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-ui text-xs">
              <thead>
                <tr className="border-b border-gold/10 text-ink-muted uppercase tracking-wider text-[0.6rem]">
                  <th className="text-left py-2 px-2">Reino</th>
                  <th className="text-center py-2 px-2">Destino</th>
                  <th className="text-center py-2 px-2">Fecha salida</th>
                  <th className="text-center py-2 px-2">Resultado</th>
                  <th className="text-right py-2 px-2">Botín</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(m => <CompletedRow key={m.id} m={m} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
