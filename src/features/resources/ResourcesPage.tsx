import { useCallback } from 'react'
import { Zap, Settings2 } from 'lucide-react'
import { GiFactory, GiOpenTreasureChest } from 'react-icons/gi'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { useBuildings, useUpgradeBuilding } from '@/features/buildings/useBuildings'
import { useAccelerate } from '@/features/queues/useAccelerate'
import { useQueueSync } from '@/features/queues/useQueueSync'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { BuildingCard } from '@/features/buildings/components/BuildingCard'
import { BUILDING_META } from '@/features/buildings/buildingMeta'
import type { BuildingInfo } from '@/features/buildings/types'
import { formatResource } from '@/lib/format'
import { tempLabel } from '@/lib/terrain'

const SECTIONS = [
  {
    id: 'production',
    label: 'Producción',
    description: 'Generan madera, piedra y grano. Requieren energía del Molino o la Catedral.',
    Icon: GiFactory,
    ids: ['sawmill', 'quarry', 'grainFarm', 'windmill', 'cathedral'],
  },
  {
    id: 'storage',
    label: 'Almacenamiento',
    description: 'Amplían el límite de recursos. Mejóralos cuando la producción supere la capacidad.',
    Icon: GiOpenTreasureChest,
    ids: ['granary', 'stonehouse', 'silo'],
  },
] as const

export function ResourcesPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useBuildings()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const upgrade = useUpgradeBuilding()
  const accelerate = useAccelerate()
  const syncQueues = useQueueSync()

  const handleCountdownEnd = useCallback(async () => {
    await syncQueues()
    refetch()
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }, [refetch, syncQueues, qc])

  if (isLoading) return <ResourcesSkeleton />

  const buildingMap = Object.fromEntries((data?.buildings ?? []).map(b => [b.id, b]))

  function canAfford(b: BuildingInfo) {
    return resources.wood >= b.costWood && resources.stone >= b.costStone && resources.grain >= (b.costGrain ?? 0)
  }

  const tempAvg = (kingdom as Record<string, unknown> | null)?.tempAvg as number | undefined
  const energyProduced = (kingdom as Record<string, unknown> | null)?.energyProduced as number | undefined
  const energyConsumed = (kingdom as Record<string, unknown> | null)?.energyConsumed as number | undefined

  // Compute future energy preview when windmill/cathedral is in the build queue
  const windmillQueued = buildingMap['windmill']?.inQueue
  const cathedralQueued = buildingMap['cathedral']?.inQueue
  const energyBuilding = windmillQueued || cathedralQueued
  const futureEnergyProd = energyBuilding ? (() => {
    const k = kingdom as Record<string, unknown> | null
    const windLv   = windmillQueued   ? (windmillQueued.level)   : (k?.windmill   as number ?? 0)
    const catLv    = cathedralQueued  ? (cathedralQueued.level)  : (k?.cathedral  as number ?? 0)
    const alchLv   = (k?.alchemy as number) ?? 0
    const windPct  = ((k?.windmillPercent  as number) ?? 10) / 10
    const catPct   = ((k?.cathedralPercent as number) ?? 10) / 10
    const wEnergy  = windLv  === 0 ? 0 : Math.floor(20 * windLv * Math.pow(1.1, windLv))
    const cEnergy  = catLv   === 0 ? 0 : Math.floor(30 * catLv  * Math.pow(1.05 + alchLv * 0.01, catLv))
    return wEnergy * windPct + cEnergy * catPct
  })() : undefined

  return (
    <div className="space-y-8">
      <div className="anim-fade-up flex items-start justify-between gap-4">
        <div>
          <span className="section-heading">Economía</span>
          <h1 className="page-title mt-0.5">Recursos</h1>
          <p className="font-body text-ink-muted text-sm mt-1.5">
            Edificios de producción y almacenamiento. La energía del Molino alimenta las minas.
          </p>
        </div>
        <button
          onClick={() => navigate('/resources/settings')}
          className="mt-1 shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/15 font-ui text-xs text-ink-muted hover:border-gold/30 hover:text-ink-mid transition-colors"
        >
          <Settings2 size={13} />
          Ajustes
        </button>
      </div>

      {/* Energy + temperature status */}
      <div className="grid grid-cols-2 gap-3 anim-fade-up-1">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={12} className={(energyProduced ?? 0) >= (energyConsumed ?? 0) ? 'text-forest-light' : 'text-crimson'} />
            <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted/60">Energía</span>
          </div>
          <p className={`font-ui text-lg tabular-nums font-semibold leading-none ${
            (energyProduced ?? 0) >= (energyConsumed ?? 0) ? 'text-forest-light' : 'text-crimson'
          }`}>
            {formatResource(energyProduced ?? 0)}
            <span className="text-ink-muted/40 text-sm font-normal mx-1">/</span>
            <span className="text-ink-muted text-sm">{formatResource(energyConsumed ?? 0)}</span>
          </p>
          {(energyConsumed ?? 0) > 0 && (energyProduced ?? 0) < (energyConsumed ?? 0) && (
            <p className="font-body text-[0.6rem] text-crimson mt-1">⚠ Déficit — producción reducida</p>
          )}
          {energyBuilding && futureEnergyProd !== undefined && futureEnergyProd !== (energyProduced ?? 0) && (
            <p className="font-body text-[0.6rem] text-gold-dim mt-1">
              🔨 → {formatResource(futureEnergyProd)} al completar
            </p>
          )}
        </Card>
        {tempAvg !== undefined && (
          <Card className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[0.7rem]">🌡️</span>
              <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted/60">Temperatura</span>
            </div>
            <p className="font-ui text-sm font-semibold text-ink leading-none">{tempLabel(tempAvg)}</p>
            <p className="font-body text-[0.6rem] text-ink-muted/50 mt-1">Afecta producción de grano</p>
          </Card>
        )}
      </div>

      {/* Building sections */}
      {SECTIONS.map((sec, ci) => {
        const buildings = sec.ids.map(id => buildingMap[id]).filter(Boolean)
        return (
          <section key={sec.id} className={`anim-fade-up-${Math.min(ci + 2, 5) as 2|3|4|5}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-parchment-warm border border-gold/20 flex items-center justify-center shrink-0">
                <sec.Icon size={17} className="text-gold-dim" />
              </div>
              <div>
                <span className="font-ui text-sm font-bold text-ink uppercase tracking-wider">{sec.label}</span>
                <p className="font-body text-xs text-ink-muted/70 mt-0.5 hidden sm:block">{sec.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {buildings.map(b => {
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
                  />
                )
              })}
            </div>
          </section>
        )
      })}

    </div>
  )
}

function ResourcesSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-20" />
        <div className="skeleton h-8 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-16 rounded-lg" />
        <div className="skeleton h-16 rounded-lg" />
      </div>
      {[5, 3].map((n, s) => (
        <div key={s}>
          <div className="flex gap-3 mb-4">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="space-y-1.5"><div className="skeleton h-3 w-24" /><div className="skeleton h-2.5 w-48" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(n)].map((_, i) => (
              <Card key={i} className="p-5 space-y-4">
                <div className="flex gap-3"><div className="skeleton w-9 h-9 rounded-lg" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-28" /><div className="skeleton h-2.5 w-full" /></div></div>
                <div className="skeleton h-8 w-full rounded" />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
