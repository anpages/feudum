import { useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { researchService } from './services/researchService'
import { getActiveKingdomId } from '@/features/kingdom/useKingdom'
import { deductResources } from '@/features/kingdom/deductResources'
import { toast } from '@/lib/toast'
import { RESEARCH_LABELS } from '@/lib/labels'
import type { ResearchInfo, ResearchResponse } from './types'
import type { Kingdom } from '@/../db/schema'

export type { ResearchInfo, ResearchResponse }

export function useResearch() {
  const prevRef = useRef<ResearchInfo[] | null>(null)
  const activeId = getActiveKingdomId()

  const result = useQuery({
    queryKey: ['research', activeId],
    queryFn: () => researchService.getAll(activeId),
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

export function useCancelResearch() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (queueId: string) => researchService.cancel(queueId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['research'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}

export function useUpgradeResearch() {
  const qc = useQueryClient()
  const activeId = getActiveKingdomId()
  const key = ['research', activeId] as const
  const kingdomKey = ['kingdom', activeId] as const

  return useMutation({
    mutationKey: ['mutate', 'research'],
    mutationFn: (researchId: string) => researchService.upgrade(researchId, activeId),

    onMutate: async (researchId: string) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<ResearchResponse>(key)

      let prevKingdom: Kingdom | undefined
      if (prev) {
        const item = prev.research.find(r => r.id === researchId)
        if (item) {
          prevKingdom = deductResources(qc, kingdomKey, {
            wood:  item.costWood,
            stone: item.costStone,
            grain: item.costGrain ?? 0,
          })

          const now = Math.floor(Date.now() / 1000)
          const finishesAt = now + item.timeSeconds
          qc.setQueryData<ResearchResponse>(key, {
            research: prev.research.map(r =>
              r.id === researchId ? { ...r, inQueue: { id: '', level: r.level + 1, startedAt: now, finishesAt } } : r
            ),
          })
        }
      }

      return { prev, prevKingdom }
    },

    onSuccess: (data, researchId) => {
      if (!data?.finishesAt) return
      qc.setQueryData<ResearchResponse>(key, (prev) => {
        if (!prev) return prev
        return {
          research: prev.research.map(r =>
            r.id === researchId && r.inQueue
              ? { ...r, inQueue: { ...r.inQueue, startedAt: data.finishesAt - data.timeSeconds, finishesAt: data.finishesAt } }
              : r
          ),
        }
      })
    },

    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData<ResearchResponse>(key, context.prev)
      if (context?.prevKingdom) qc.setQueryData(kingdomKey, context.prevKingdom)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['research'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
