import { useQuery } from '@tanstack/react-query'
import { adminService } from '../services/adminService'
import { formatResource, formatDuration } from '@/lib/format'
import type { AdminExpedition } from '../types'

function outcomeLabel(outcome: string) {
  const map: Record<string, string> = {
    resources: '💰 Recursos',
    units:     '⚔️ Unidades',
    nothing:   '—',
    black_hole:'🌑 Agujero negro',
    delay:     '⏳ Retraso',
    speedup:   '⚡ Aceleración',
    pirates:   '☠️ Piratas',
    aliens:    '👾 Alienígenas',
    merchant:  '🛒 Mercader',
    ether:     '✨ Éter',
  }
  return map[outcome] ?? outcome
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

function ExpeditionRow({ m, now }: { m: AdminExpedition; now: number }) {
  const loot = (m.woodLoad ?? 0) + (m.stoneLoad ?? 0) + (m.grainLoad ?? 0)
  const outcome = m.result ? (m.result as Record<string, unknown>).outcome as string : null

  return (
    <tr className="border-b border-gold/5 hover:bg-parchment-warm/3 transition-colors">
      <td className="py-2 px-2">
        <div className="font-ui text-xs font-semibold text-ink">{m.kingdomName}</div>
        <div className="font-ui text-[0.6rem] text-ink-muted">{m.startRealm}:{m.startRegion}:{m.startSlot}</div>
        {m.isNpc && <span className="badge badge-stone text-[0.55rem] px-1 py-0">NPC</span>}
      </td>
      <td className="py-2 px-2 text-center">
        <span className="font-ui text-xs text-gold-dim">{m.targetRealm}:{m.targetRegion}:16</span>
      </td>
      <td className={`py-2 px-2 text-center font-ui text-xs font-semibold ${stateColor(m.state)}`}>
        {stateLabel(m.state)}
      </td>
      <td className="py-2 px-2 text-right font-ui text-xs text-ink-muted tabular-nums">
        {m.state === 'active' && m.arrivalTime > now
          ? formatDuration(m.arrivalTime - now)
          : m.state === 'returning' && m.returnTime && m.returnTime > now
          ? formatDuration(m.returnTime - now)
          : '—'}
      </td>
      <td className="py-2 px-2 text-center font-ui text-xs text-ink-mid">
        {outcome ? outcomeLabel(outcome) : '—'}
      </td>
      <td className="py-2 px-2 text-right font-ui text-xs text-gold tabular-nums">
        {loot > 0 ? formatResource(loot) : '—'}
      </td>
    </tr>
  )
}

export function ExpeditionsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'expeditions'],
    queryFn: adminService.getExpeditions,
    refetchInterval: 30_000,
  })

  const { depletion, active, recent, now } = data ?? {}

  return (
    <div className="space-y-6">

      {/* Depletion map */}
      {depletion && Object.keys(depletion).length > 0 && (
        <div>
          <h3 className="font-ui text-xs font-semibold uppercase tracking-widest text-ink-muted mb-2">Depleción por región</h3>
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
        <h3 className="font-ui text-xs font-semibold uppercase tracking-widest text-ink-muted mb-2">En curso</h3>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}</div>
        ) : !active?.length ? (
          <p className="font-ui text-sm text-ink-muted text-center py-6">Sin expediciones activas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-ui text-xs">
              <thead>
                <tr className="border-b border-gold/10 text-ink-muted uppercase tracking-wider">
                  <th className="text-left py-2 px-2">Reino</th>
                  <th className="text-center py-2 px-2">Destino</th>
                  <th className="text-center py-2 px-2">Estado</th>
                  <th className="text-right py-2 px-2">Tiempo</th>
                  <th className="text-center py-2 px-2">Resultado</th>
                  <th className="text-right py-2 px-2">Botín</th>
                </tr>
              </thead>
              <tbody>
                {active?.map(m => <ExpeditionRow key={m.id} m={m} now={now ?? 0} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent completed */}
      {(recent?.length ?? 0) > 0 && (
        <div>
          <h3 className="font-ui text-xs font-semibold uppercase tracking-widest text-ink-muted mb-2">Completadas (últimas 24h)</h3>
          <div className="overflow-x-auto">
            <table className="w-full font-ui text-xs">
              <thead>
                <tr className="border-b border-gold/10 text-ink-muted uppercase tracking-wider">
                  <th className="text-left py-2 px-2">Reino</th>
                  <th className="text-center py-2 px-2">Destino</th>
                  <th className="text-center py-2 px-2">Estado</th>
                  <th className="text-right py-2 px-2">Tiempo</th>
                  <th className="text-center py-2 px-2">Resultado</th>
                  <th className="text-right py-2 px-2">Botín</th>
                </tr>
              </thead>
              <tbody>
                {recent?.map(m => <ExpeditionRow key={m.id} m={m} now={now ?? 0} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
