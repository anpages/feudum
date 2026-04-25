import { useCallback } from 'react'
import { GiVillage } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { useBuildings, useUpgradeBuilding, useCancelBuilding } from '@/features/buildings/useBuildings'
import { useAccelerate } from '@/features/queues/useAccelerate'
import { useQueueSync } from '@/features/queues/useQueueSync'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { BuildingCard } from '@/features/buildings/components/BuildingCard'
import { BUILDING_META, FACILITY_BUILDING_IDS } from '@/features/buildings/buildingMeta'
import type { BuildingInfo } from '@/features/buildings/types'

function FieldsBadge({ used, max, className = '' }: { used: number; max: number; className?: string }) {
  const full = used >= max
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-ui text-xs font-semibold border ${
      full ? 'border-crimson/30 bg-crimson/10 text-crimson' : 'border-gold/20 bg-parchment-warm text-ink-mid'
    } ${className}`}>
      <span className="tabular-nums">{used}/{max}</span>
      <span className="text-ink-muted/60 font-normal">campos</span>
      {full && <span className="ml-0.5">⚠</span>}
    </span>
  )
}

export function FacilitiesPage() {
  const { data, isLoading, refetch } = useBuildings()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const upgrade = useUpgradeBuilding()
  const cancel = useCancelBuilding()
  const accelerate = useAccelerate()
  const syncQueues = useQueueSync()

  const handleCountdownEnd = useCallback(async () => {
    await syncQueues()
    refetch()
  }, [refetch, syncQueues])

  if (isLoading) return <FacilitiesSkeleton />

  const buildingMap = Object.fromEntries((data?.buildings ?? []).map(b => [b.id, b]))
  const queueFull = (data?.totalQueueCount ?? 0) >= 5

  function canAfford(b: BuildingInfo) {
    return resources.wood >= b.costWood && resources.stone >= b.costStone && resources.grain >= (b.costGrain ?? 0)
  }

  const buildings = FACILITY_BUILDING_IDS.map(id => buildingMap[id]).filter(Boolean)

  return (
    <div className="space-y-8">
      <div className="anim-fade-up">
        <span className="section-heading">Infraestructura</span>
        <h1 className="page-title mt-0.5">Instalaciones</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Edificios que habilitan funciones clave: tropas, investigación y velocidad de construcción.
        </p>
        {data?.fields && <FieldsBadge used={data.fields.used} max={data.fields.max} className="mt-2" />}
      </div>

      <section className="anim-fade-up-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-parchment-warm border border-gold/20 flex items-center justify-center shrink-0">
            <GiVillage size={17} className="text-gold-dim" />
          </div>
          <div>
            <span className="font-ui text-sm font-bold text-ink uppercase tracking-wider">Instalaciones</span>
            <p className="font-body text-xs text-ink-muted/70 mt-0.5 hidden sm:block">
              Sin Cuartel no hay tropas. Sin Academia no hay investigación. Sin Taller construyes más lento.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {buildings.map((b, i) => {
            const meta = BUILDING_META[b.id]
            if (!meta) return null
            return (
              <BuildingCard
                key={b.id}
                building={b}
                meta={meta}
                kingdom={kingdom}
                canAfford={canAfford(b)}
                resources={resources}
                isUpgrading={upgrade.isPending && upgrade.variables === b.id}
                onUpgrade={() => upgrade.mutate(b.id)}
                onCountdownEnd={handleCountdownEnd}
                onAccelerate={b.inQueue ? () => accelerate.mutate('building') : undefined}
                isAccelerating={accelerate.isPending}
                onCancel={(queueId) => cancel.mutate(queueId)}
                isCancelling={cancel.isPending}
                queueFull={queueFull && !b.inQueue}
                animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1|2|3|4|5}`}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

function FacilitiesSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-24" />
        <div className="skeleton h-8 w-36" />
      </div>
      <div className="flex gap-3 mb-4">
        <div className="skeleton w-8 h-8 rounded-lg" />
        <div className="space-y-1.5"><div className="skeleton h-3 w-28" /><div className="skeleton h-2.5 w-56" /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(7)].map((_, i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex gap-3"><div className="skeleton w-9 h-9 rounded-lg" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-28" /><div className="skeleton h-2.5 w-full" /></div></div>
            <div className="skeleton h-8 w-full rounded" />
          </Card>
        ))}
      </div>
    </div>
  )
}
