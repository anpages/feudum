import { useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'
import { BUILDING_LABELS } from '@/lib/labels'

export interface BuildingInfo {
  id: string
  level: number
  costWood: number
  costStone: number
  costGrain: number
  timeSeconds: number
  requiresMet: boolean
  requires: { type: 'building' | 'research'; id: string; level: number }[]
  inQueue: { level: number; finishesAt: number } | null
}

export interface BuildingsResponse {
  buildings: BuildingInfo[]
}

export function useBuildings() {
  const prevRef = useRef<BuildingInfo[] | null>(null)

  const { data, ...rest } = useQuery({
    queryKey: ['buildings'],
    queryFn:  () => api.get<BuildingsResponse>('/buildings'),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const buildings = query.state.data?.buildings ?? []
      const now = Math.floor(Date.now() / 1000)
      const hasActive = buildings.some(b => b.inQueue && b.inQueue.finishesAt > now)
      return hasActive ? 3_000 : 10_000
    },
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

  return useMutation({
    mutationFn: (buildingId: string) =>
      api.post<{ ok: boolean; finishesAt: number; timeSeconds: number; cost: { wood: number; stone: number } }>(
        '/buildings/upgrade',
        { building: buildingId },
      ),

    onMutate: async (buildingId: string) => {
      await qc.cancelQueries({ queryKey: ['buildings'] })

      const prev = qc.getQueryData<BuildingsResponse>(['buildings'])

      if (prev) {
        const building = prev.buildings.find(b => b.id === buildingId)
        if (building) {
          const finishesAt = Math.floor(Date.now() / 1000) + building.timeSeconds
          qc.setQueryData<BuildingsResponse>(['buildings'], {
            buildings: prev.buildings.map(b =>
              b.id === buildingId
                ? { ...b, inQueue: { level: b.level + 1, finishesAt } }
                : b
            ),
          })
        }
      }

      return { prev }
    },

    onError: (_err, _buildingId, context) => {
      if (context?.prev) {
        qc.setQueryData<BuildingsResponse>(['buildings'], context.prev)
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['buildings'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
