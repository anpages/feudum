import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ResearchInfo {
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

export interface ResearchResponse {
  research: ResearchInfo[]
}

export function useResearch() {
  return useQuery({
    queryKey: ['research'],
    queryFn:  () => api.get<ResearchResponse>('/research'),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const items = query.state.data?.research ?? []
      const now   = Math.floor(Date.now() / 1000)
      return items.some(r => r.inQueue && r.inQueue.finishesAt > now) ? 3_000 : 10_000
    },
  })
}

export function useUpgradeResearch() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (researchId: string) =>
      api.post<{ ok: boolean; finishesAt: number; timeSeconds: number }>('/research/upgrade', { research: researchId }),

    onMutate: async (researchId: string) => {
      await qc.cancelQueries({ queryKey: ['research'] })
      const prev = qc.getQueryData<ResearchResponse>(['research'])

      if (prev) {
        const item = prev.research.find(r => r.id === researchId)
        if (item) {
          const finishesAt = Math.floor(Date.now() / 1000) + item.timeSeconds
          qc.setQueryData<ResearchResponse>(['research'], {
            research: prev.research.map(r =>
              r.id === researchId
                ? { ...r, inQueue: { level: r.level + 1, finishesAt } }
                : r
            ),
          })
        }
      }

      return { prev }
    },

    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData<ResearchResponse>(['research'], context.prev)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['research'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
