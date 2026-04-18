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
  return useQuery({
    queryKey: ['buildings'],
    queryFn:  () => api.get<BuildingsResponse>('/buildings'),
    refetchInterval: 10_000,
    staleTime:        5_000,
  })
}

export function useUpgradeBuilding() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (building: string) =>
      api.post<{ ok: boolean; finishesAt: number; timeSeconds: number; cost: { wood: number; stone: number } }>(
        '/buildings/upgrade',
        { building },
      ),
    onSuccess: () => {
      // Invalidar buildings y kingdom para reflejar recursos deducidos y cola nueva
      qc.invalidateQueries({ queryKey: ['buildings'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
