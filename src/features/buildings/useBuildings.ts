import { useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buildingsService } from './services/buildingsService'
import { getActiveKingdomId } from '@/features/kingdom/useKingdom'
import { deductResources } from '@/features/kingdom/deductResources'
import { toast } from '@/lib/toast'
import { BUILDING_LABELS } from '@/lib/labels'
import type { BuildingInfo, BuildingsResponse } from './types'
import type { Kingdom } from '@/../db/schema'

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

export function useCancelBuilding() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (queueId: string) => buildingsService.cancel(queueId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['buildings'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}

export function useUpgradeBuilding() {
  const qc = useQueryClient()
  const activeId = getActiveKingdomId()
  const key = ['buildings', activeId] as const
  const kingdomKey = ['kingdom', activeId] as const

  return useMutation({
    mutationKey: ['mutate', 'building'],
    mutationFn: (buildingId: string) => buildingsService.upgrade(buildingId, activeId),

    onMutate: async (buildingId: string) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<BuildingsResponse>(key)

      let prevKingdom: Kingdom | undefined
      if (prev) {
        const building = prev.buildings.find(b => b.id === buildingId)
        if (building) {
          prevKingdom = deductResources(qc, kingdomKey, {
            wood:  building.costWood,
            stone: building.costStone,
            grain: building.costGrain ?? 0,
          })

          const now = Math.floor(Date.now() / 1000)
          // Use the actual latest active finishesAt — not totalQueueCount, which can be stale
          // if items finished between the last fetch and this click.
          const lastActiveFinishesAt = prev.buildings
            .filter(b => b.inQueue && b.inQueue.finishesAt > now)
            .reduce((max, b) => Math.max(max, b.inQueue!.finishesAt), 0)
          const startedAt  = lastActiveFinishesAt > 0 ? lastActiveFinishesAt : now
          const finishesAt = startedAt + building.timeSeconds
          qc.setQueryData<BuildingsResponse>(key, {
            ...prev,
            totalQueueCount: prev.totalQueueCount + 1,
            buildings: prev.buildings.map(b =>
              b.id === buildingId
                ? { ...b, inQueue: { id: '', level: b.nextLevel, startedAt, finishesAt }, queueDepth: 1 }
                : b
            ),
          })
        }
      }

      return { prev, prevKingdom }
    },

    onSuccess: (data, buildingId) => {
      if (!data?.finishesAt) return
      qc.setQueryData<BuildingsResponse>(key, (prev) => {
        if (!prev) return prev
        return {
          ...prev,
          buildings: prev.buildings.map(b => {
            if (b.id !== buildingId || !b.inQueue) return b
            return { ...b, inQueue: { ...b.inQueue, startedAt: data.finishesAt - data.timeSeconds, finishesAt: data.finishesAt } }
          }),
        }
      })
    },

    onError: (err, _buildingId, context) => {
      if (context?.prev) qc.setQueryData<BuildingsResponse>(key, context.prev)
      if (context?.prevKingdom) qc.setQueryData(kingdomKey, context.prevKingdom)
      try {
        const body = JSON.parse((err as Error).message)
        toast.error(body.error ?? 'Error al iniciar construcción')
      } catch {
        toast.error('Error al iniciar construcción')
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['buildings'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
