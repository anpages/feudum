import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type MissionType = 'attack' | 'transport' | 'spy' | 'scavenge' | 'colonize'
export type MissionState = 'active' | 'returning'

export interface ArmyMission {
  id: number
  missionType: MissionType
  state: MissionState
  origin: { realm: number; region: number; slot: number }
  target: { realm: number; region: number; slot: number }
  arrivalTime: number
  returnTime: number | null
  eta: number
  units: Partial<Record<string, number>>
  resources: { wood: number; stone: number; grain: number }
  result: {
    type: string
    outcome?: string
    rounds?: number
    loot?: { wood: number; stone: number; grain: number }
    debris?: { wood: number; stone: number }
    lostAtk?: Record<string, number>
    lostDef?: Record<string, number>
    delivered?: boolean
    reason?: string
    message?: string
  } | null
}

export interface ArmiesResponse {
  missions: ArmyMission[]
}

export interface SendArmyParams {
  missionType: MissionType
  target: { realm: number; region: number; slot: number }
  units: Partial<Record<string, number>>
  resources?: { wood: number; stone: number; grain: number }
}

export function useArmies() {
  return useQuery({
    queryKey: ['armies'],
    queryFn: () => api.get<ArmiesResponse>('/armies'),
    staleTime: 3_000,
    refetchInterval: (query) => {
      const missions = query.state.data?.missions ?? []
      return missions.length > 0 ? 5_000 : 15_000
    },
  })
}

export function useSendArmy() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (params: SendArmyParams) =>
      api.post<{ ok: boolean; missionId: number; arrivalTime: number; returnTime: number; travelSeconds: number }>(
        '/armies/send', params,
      ),

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['armies'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
      qc.invalidateQueries({ queryKey: ['barracks'] })
    },
  })
}

export function useRecallArmy() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (missionId: number) =>
      api.post<{ ok: boolean; returnTime: number }>('/armies/recall', { missionId }),

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['armies'] })
    },
  })
}
