import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { armiesService } from './services/armiesService'
import { getActiveKingdomId } from '@/features/kingdom/useKingdom'
import type { ArmiesResponse, SendArmyResponse, RecallArmyResponse } from './types'
import type { MissionType, ArmyMission, SendArmyParams } from '@/shared/types'
import type { Kingdom } from '@/../db/schema'

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
  })
}

export function useSendArmy() {
  const qc = useQueryClient()
  const activeId = getActiveKingdomId()
  const kingdomKey = ['kingdom', activeId] as const
  const armiesKey  = ['armies'] as const

  return useMutation({
    mutationKey: ['mutate', 'army'],
    mutationFn: (params: SendArmyParams) => armiesService.send(params),

    onMutate: async (params) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: kingdomKey }),
        qc.cancelQueries({ queryKey: armiesKey }),
      ])

      const prevKingdom = qc.getQueryData<Kingdom>(kingdomKey)
      const prevArmies  = qc.getQueryData<ArmiesResponse>(armiesKey)

      // 1. Deduct units + cargo resources from kingdom cache
      if (prevKingdom) {
        const k = prevKingdom as unknown as Record<string, number>
        const patch: Record<string, number> = {}
        for (const [unit, n] of Object.entries(params.units)) {
          if (n && n > 0) patch[unit] = Math.max(0, (k[unit] ?? 0) - n)
        }
        if (params.resources) {
          patch.wood  = Math.max(0, k.wood  - (params.resources.wood  ?? 0))
          patch.stone = Math.max(0, k.stone - (params.resources.stone ?? 0))
          patch.grain = Math.max(0, k.grain - (params.resources.grain ?? 0))
        }
        qc.setQueryData<Kingdom>(kingdomKey, { ...prevKingdom, ...patch } as Kingdom)
      }

      // 2. Inject placeholder mission so the UI lists it instantly
      if (prevArmies && prevKingdom) {
        const k = prevKingdom as unknown as { realm: number; region: number; slot: number }
        const now = Math.floor(Date.now() / 1000)
        const placeholder: ArmyMission = {
          id: `optim_${now}`,
          missionType: params.missionType,
          state: 'active',
          origin: { realm: k.realm, region: k.region, slot: k.slot },
          target: params.target,
          arrivalTime: now + 60,  // placeholder; server returns real ETA on settle
          returnTime:  null,
          eta: 60,
          units: params.units,
          resources: params.resources ?? { wood: 0, stone: 0, grain: 0 },
          result: null,
        }
        qc.setQueryData<ArmiesResponse>(armiesKey, {
          missions: [placeholder, ...prevArmies.missions],
        })
      }

      return { prevKingdom, prevArmies }
    },

    onError: (_err, _vars, context) => {
      if (context?.prevKingdom) qc.setQueryData<Kingdom>(kingdomKey, context.prevKingdom)
      if (context?.prevArmies)  qc.setQueryData<ArmiesResponse>(armiesKey, context.prevArmies)
    },

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
    mutationKey: ['mutate', 'army'],
    mutationFn: (missionId: string) => armiesService.recall(missionId),
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
    mutationKey: ['mutate', 'army'],
    mutationFn: ({ missionId, accept }: { missionId: string; accept: boolean }) =>
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
