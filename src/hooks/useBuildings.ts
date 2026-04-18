import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface BuildingInfo {
  id: string
  level: number
  costWood: number
  costStone: number
  timeSeconds: number
  requiresMet: boolean
  requires: { building: string; level: number } | null
  inQueue: { level: number; finishesAt: number } | null
}

export interface BuildingsResponse {
  buildings: BuildingInfo[]
}

export function useBuildings() {
  const { data, ...rest } = useQuery({
    queryKey: ['buildings'],
    queryFn:  () => api.get<BuildingsResponse>('/buildings'),
    staleTime: 5_000,
    // Poll aggressively when any building is in queue; otherwise each 10s
    refetchInterval: (query) => {
      const buildings = query.state.data?.buildings ?? []
      const now = Math.floor(Date.now() / 1000)
      const hasActive = buildings.some(b => b.inQueue && b.inQueue.finishesAt > now)
      return hasActive ? 3_000 : 10_000
    },
  })

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

    // Optimistic update: show building as queued immediately
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

    // Roll back on error
    onError: (_err, _buildingId, context) => {
      if (context?.prev) {
        qc.setQueryData<BuildingsResponse>(['buildings'], context.prev)
      }
    },

    // Always sync from server and deduct resources from kingdom
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['buildings'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
