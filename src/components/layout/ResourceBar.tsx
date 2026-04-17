import { useKingdom } from '@/hooks/useKingdom'
import { useResourceTicker } from '@/hooks/useResourceTicker'
import { formatResource } from '@/lib/format'

export function ResourceBar() {
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)

  return (
    <header className="bg-stone-900 border-b border-stone-700 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Kingdom name */}
        <span className="font-display text-gold text-sm font-semibold tracking-wide">
          {kingdom?.name ?? '…'}
        </span>

        {/* Resources */}
        <div className="flex items-center gap-6">
          <ResourceItem icon="🪵" label="Madera" value={resources.wood} cap={kingdom?.woodCapacity} />
          <ResourceItem icon="🪨" label="Piedra" value={resources.stone} cap={kingdom?.stoneCapacity} />
          <ResourceItem icon="🌾" label="Grano"  value={resources.grain} cap={kingdom?.grainCapacity} />
        </div>

        {/* Population */}
        <div className="text-xs text-stone-400">
          👥 {kingdom?.populationUsed ?? 0} / {kingdom?.populationMax ?? 0}
        </div>
      </div>
    </header>
  )
}

function ResourceItem({
  icon,
  label,
  value,
  cap,
}: {
  icon: string
  label: string
  value: number
  cap?: number
}) {
  const isFull = cap !== undefined && value >= cap
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span>{icon}</span>
      <span className="text-stone-400 hidden sm:inline">{label}:</span>
      <span className={isFull ? 'text-crimson font-semibold' : 'text-parchment'}>
        {formatResource(value)}
      </span>
      {cap !== undefined && (
        <span className="text-stone-500 text-xs">/ {formatResource(cap)}</span>
      )}
    </div>
  )
}
