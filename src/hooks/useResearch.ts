import { useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'
import { RESEARCH_LABELS } from '@/lib/labels'

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
  const prevRef = useRef<ResearchInfo[] | null>(null)

  const result = useQuery({
    queryKey: ['research'],
    queryFn:  () => api.get<ResearchResponse>('/research'),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const items = query.state.data?.research ?? []
      const now   = Math.floor(Date.now() / 1000)
      return items.some(r => r.inQueue && r.inQueue.finishesAt > now) ? 3_000 : 10_000
    },
  })

  useEffect(() => {
    const items = result.data?.research
    if (!items) return
    if (prevRef.current) {
      for (const r of items) {
        const prev = prevRef.current.find(p => p.id === r.id)
        if (prev?.inQueue && !r.inQueue && r.level > prev.level) {
          toast.success(`${RESEARCH_LABELS[r.id] ?? r.id} alcanzado nivel ${r.level}`)
        }
      }
    }
    prevRef.current = items
  }, [result.data?.research])

  return result
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
