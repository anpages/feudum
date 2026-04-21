import { useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buildingsService } from './services/buildingsService'
import { getActiveKingdomId } from '@/features/kingdom/useKingdom'
import { toast } from '@/lib/toast'
import { BUILDING_LABELS } from '@/lib/labels'
import type { BuildingInfo, BuildingsResponse } from './types'

export type { BuildingInfo, BuildingsResponse }

export function useBuildings() {
  const prevRef = useRef<BuildingInfo[] | null>(null)
  const activeId = getActiveKingdomId()

  const { data, ...rest } = useQuery({
    queryKey: ['buildings', activeId],
    queryFn: () => buildingsService.getAll(activeId),
  })

  useEffect(() => {
    const buildings = data?.buildings
    if (!buildings) return
    if (prevRef.current) {
      for (const b of buildings) {
        const prev = prevRef.current.find(p => p.id === b.id)
        if (prev?.inQueue && !b.inQueue && b.level > prev.level) {
          toast.success(`${BUILDING_LABELS[b.id] ?? b.id} mejorado a nivel ${b.level}`)
        }
      }
    }
    prevRef.current = buildings
  }, [data?.buildings])

  return { data, ...rest }
}

export function useUpgradeBuilding() {
  const qc = useQueryClient()
  const activeId = getActiveKingdomId()
  const key = ['buildings', activeId] as const

  return useMutation({
    mutationKey: ['mutate', 'building'],
    mutationFn: (buildingId: string) => buildingsService.upgrade(buildingId),

    onMutate: async (buildingId: string) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<BuildingsResponse>(key)

      if (prev) {
        const building = prev.buildings.find(b => b.id === buildingId)
        if (building) {
          const finishesAt = Math.floor(Date.now() / 1000) + building.timeSeconds
          qc.setQueryData<BuildingsResponse>(key, {
            ...prev,
            totalQueueCount: prev.totalQueueCount + 1,
            buildings: prev.buildings.map(b =>
              b.id === buildingId
                ? { ...b, inQueue: { level: b.nextLevel, startedAt: Math.floor(Date.now() / 1000), finishesAt }, queueDepth: 1 }
                : b
            ),
          })
        }
      }

      return { prev }
    },

    onError: (_err, _buildingId, context) => {
      if (context?.prev) qc.setQueryData<BuildingsResponse>(key, context.prev)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['buildings'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
