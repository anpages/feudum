import { Badge } from '@/components/ui/Badge'
import { LossTable } from './LossTable'

export function MissileMessageDetail({ data }: { data: Record<string, unknown> }) {
  const targetName = data.targetName as string | null | undefined
  const sentMissiles = (data.sentMissiles as number) ?? 0
  const intercepted = (data.intercepted as number) ?? 0
  const remaining = (data.remaining as number) ?? 0
  const damageDealt = (data.damageDealt as Record<string, number>) ?? {}
  const hasTarget = typeof targetName === 'string' && targetName.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-body text-sm text-ink">
          Objetivo: <strong>{hasTarget ? targetName : '(sin defensa)'}</strong>
        </span>
        {remaining === 0 && intercepted > 0 && <Badge variant="stone">Interceptados</Badge>}
        {remaining > 0 && Object.keys(damageDealt).length > 0 && <Badge variant="crimson">Impacto</Badge>}
        {remaining > 0 && Object.keys(damageDealt).length === 0 && <Badge variant="stone">Sin objetivo</Badge>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-gold/10 bg-obsidian/60 p-3 text-center">
          <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted mb-1">Lanzados</p>
          <p className="font-ui text-lg text-ink tabular-nums">{sentMissiles}</p>
        </div>
        <div className="rounded border border-gold/10 bg-obsidian/60 p-3 text-center">
          <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted mb-1">Interceptados</p>
          <p className="font-ui text-lg text-gold-dim tabular-nums">{intercepted}</p>
        </div>
        <div className="rounded border border-gold/10 bg-obsidian/60 p-3 text-center">
          <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted mb-1">Impactos</p>
          <p className="font-ui text-lg text-crimson tabular-nums">{remaining}</p>
        </div>
      </div>

      {Object.keys(damageDealt).length > 0 && (
        <LossTable title="Defensas destruidas" losses={damageDealt} />
      )}
    </div>
  )
}
