import { BuildingCard } from './BuildingCard'
import type { BuildingInfo } from '../types'
import type { BuildingMeta } from './BuildingCard'
import type { CategoryMeta } from '../buildingsMeta'

export function BuildingCategory({
  category,
  buildingMap,
  metaMap,
  animIndex,
  kingdom,
  canAfford,
  upgrade,
  accelerate,
  onCountdownEnd,
}: {
  category: CategoryMeta
  buildingMap: Record<string, BuildingInfo>
  metaMap: Record<string, BuildingMeta>
  animIndex: 1 | 2 | 3 | 4 | 5
  kingdom: any
  canAfford: (b: BuildingInfo) => boolean
  upgrade: { isPending: boolean; variables: string | undefined; mutate: (id: string) => void }
  accelerate: { isPending: boolean; mutate: (type: 'building' | 'research' | 'unit') => void }
  onCountdownEnd: () => void
}) {
  const buildings = category.order.map(id => buildingMap[id]).filter(Boolean)

  return (
    <section className={`anim-fade-up-${animIndex}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-parchment-warm border border-gold/20 flex items-center justify-center shrink-0">
          <category.Icon size={17} className="text-gold-dim" />
        </div>
        <div>
          <span className="font-ui text-sm font-bold text-ink uppercase tracking-wider">{category.label}</span>
          <p className="font-body text-xs text-ink-muted/70 mt-0.5 hidden sm:block">{category.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {buildings.map(b => {
          const meta = metaMap[b.id]
          if (!meta) return null
          const inQueue = !!b.inQueue
          const locked = !b.requiresMet && !inQueue
          return (
            <BuildingCard
              key={b.id}
              building={b}
              meta={meta}
              kingdom={kingdom}
              canAfford={canAfford(b)}
              isUpgrading={upgrade.isPending && upgrade.variables === b.id}
              onUpgrade={() => upgrade.mutate(b.id)}
              onCountdownEnd={onCountdownEnd}
              onAccelerate={inQueue ? () => accelerate.mutate('building') : undefined}
              isAccelerating={accelerate.isPending}
              dimmed={locked}
            />
          )
        })}
      </div>
    </section>
  )
}
