import { Zap } from 'lucide-react'
import { formatResource } from '@/lib/format'

export function EnergyPill({ kingdom }: { kingdom: Record<string, unknown> | null | undefined }) {
  const produced = (kingdom?.energyProduced as number | undefined) ?? 0
  const consumed = (kingdom?.energyConsumed as number | undefined) ?? 0
  const ok = produced >= consumed
  return (
    <div
      className="hidden md:flex resource-pill items-center gap-1"
      title={`Energía: ${formatResource(produced)} producida / ${formatResource(consumed)} consumida${!ok ? ' — déficit' : ''}`}
    >
      <Zap size={10} className={ok ? 'text-forest-light' : 'text-crimson'} />
      <span className={`font-ui text-xs tabular-nums ${ok ? 'text-forest-light' : 'text-crimson'}`}>
        {formatResource(produced)}
        <span className="text-ink-muted/40 mx-0.5">/</span>
        <span className="text-ink-muted">{formatResource(consumed)}</span>
      </span>
    </div>
  )
}
