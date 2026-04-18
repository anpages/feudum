import { useState, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { useBuildings, useUpgradeBuilding } from '@/features/buildings/useBuildings'
import { useAccelerate } from '@/features/queues/useAccelerate'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { toast } from '@/lib/toast'
import { BUILDING_META, CATEGORIES, GUIDE_STEPS, GUIDE_STORAGE_KEY } from './buildingsMeta'
import { BeginnerGuide } from './components/BeginnerGuide'
import { BuildingCategory } from './components/BuildingCategory'
import type { BuildingInfo } from './types'

export function BuildingsPage() {
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useBuildings()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const upgrade = useUpgradeBuilding()
  const accelerate = useAccelerate()
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideDismissed, setGuideDismissed] = useState(
    () => localStorage.getItem(GUIDE_STORAGE_KEY) === '1'
  )

  const handleCountdownEnd = useCallback(() => {
    refetch()
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }, [refetch, qc])

  function dismissGuide() {
    localStorage.setItem(GUIDE_STORAGE_KEY, '1')
    setGuideDismissed(true)
    setGuideOpen(false)
  }

  useEffect(() => {
    if (guideDismissed || !data?.buildings) return
    const buildingMap = Object.fromEntries(data.buildings.map(b => [b.id, b]))
    const allDone = GUIDE_STEPS.every(s => (buildingMap[s.id]?.level ?? 0) >= 1)
    if (allDone) {
      localStorage.setItem(GUIDE_STORAGE_KEY, '1')
      setGuideDismissed(true)
      setGuideOpen(false)
      toast.success('¡Base inicial completada! Tu reino está listo para crecer.')
    }
  }, [data?.buildings, guideDismissed])

  if (isLoading) return <BuildingsSkeleton />

  const buildingMap = Object.fromEntries((data?.buildings ?? []).map(b => [b.id, b]))

  function canAfford(b: BuildingInfo) {
    return (
      resources.wood  >= b.costWood &&
      resources.stone >= b.costStone &&
      resources.grain >= (b.costGrain ?? 0)
    )
  }

  return (
    <div className="space-y-8">
      <div className="anim-fade-up">
        <span className="section-heading">Infraestructura</span>
        <h1 className="page-title mt-0.5">Construcción</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Mejora tus edificios para aumentar la producción y desbloquear nuevas capacidades.
        </p>
      </div>

      {!guideDismissed && (
        <BeginnerGuide
          open={guideOpen}
          buildingMap={buildingMap}
          onToggle={() => setGuideOpen(v => !v)}
          onDismiss={dismissGuide}
        />
      )}

      {CATEGORIES.map((cat, ci) => (
        <BuildingCategory
          key={cat.id}
          category={cat}
          buildingMap={buildingMap}
          metaMap={BUILDING_META}
          animIndex={Math.min(ci + 2, 5) as 1 | 2 | 3 | 4 | 5}
          kingdom={kingdom}
          canAfford={canAfford}
          upgrade={upgrade}
          accelerate={accelerate}
          onCountdownEnd={handleCountdownEnd}
        />
      ))}
    </div>
  )
}

function BuildingsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-20" />
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-3 w-64" />
      </div>
      <div className="skeleton h-14 rounded-xl" />
      {[0, 1, 2].map(s => (
        <div key={s}>
          <div className="flex gap-3 mb-4">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-2.5 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(s === 1 ? 3 : s === 2 ? 4 : 5)].map((_, i) => (
              <Card key={i} className="p-5 space-y-4">
                <div className="flex gap-3">
                  <div className="skeleton w-9 h-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-32" />
                    <div className="skeleton h-2.5 w-full" />
                    <div className="skeleton h-2.5 w-3/4" />
                  </div>
                </div>
                <div className="skeleton h-8 w-full rounded" />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
