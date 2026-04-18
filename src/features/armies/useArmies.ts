import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { armiesService } from './services/armiesService'
import type { ArmiesResponse, SendArmyResponse, RecallArmyResponse } from './types'
import type { MissionType, ArmyMission, SendArmyParams } from '@/shared/types'

export type {
  MissionType,
  ArmyMission,
  SendArmyParams,
  ArmiesResponse,
  SendArmyResponse,
  RecallArmyResponse,
}

export function useArmies() {
  return useQuery({
    queryKey: ['armies'],
    queryFn: armiesService.getAll,
    staleTime: 3_000,
    refetchInterval: query => {
      const missions = query.state.data?.missions ?? []
      return missions.length > 0 ? 5_000 : 15_000
    },
  })
}

export function useSendArmy() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (params: SendArmyParams) => armiesService.send(params),
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
    mutationFn: (missionId: number) => armiesService.recall(missionId),
    onMutate: async (missionId) => {
      await qc.cancelQueries({ queryKey: ['armies'] })
      const prev = qc.getQueryData<ArmiesResponse>(['armies'])
      if (prev) {
        qc.setQueryData<ArmiesResponse>(['armies'], {
          missions: prev.missions.map(m =>
            m.id === missionId ? { ...m, state: 'returning' as const } : m
          ),
        })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData(['armies'], context.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['armies'] })
    },
  })
}

export function useMerchantRespond() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ missionId, accept }: { missionId: number; accept: boolean }) =>
      armiesService.merchantRespond(missionId, accept),
    onMutate: async ({ missionId }) => {
      await qc.cancelQueries({ queryKey: ['armies'] })
      const prev = qc.getQueryData<ArmiesResponse>(['armies'])
      if (prev) {
        qc.setQueryData<ArmiesResponse>(['armies'], {
          missions: prev.missions.filter(m => m.id !== missionId),
        })
      }
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData(['armies'], context.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['armies'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
