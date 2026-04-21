import { useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { researchService } from './services/researchService'
import { getActiveKingdomId } from '@/features/kingdom/useKingdom'
import { toast } from '@/lib/toast'
import { RESEARCH_LABELS } from '@/lib/labels'
import type { ResearchInfo, ResearchResponse } from './types'

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

export function useUpgradeResearch() {
  const qc = useQueryClient()
  const activeId = getActiveKingdomId()
  const key = ['research', activeId] as const

  return useMutation({
    mutationKey: ['mutate', 'research'],
    mutationFn: (researchId: string) => researchService.upgrade(researchId),

    onMutate: async (researchId: string) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<ResearchResponse>(key)

      if (prev) {
        const item = prev.research.find(r => r.id === researchId)
        if (item) {
          const finishesAt = Math.floor(Date.now() / 1000) + item.timeSeconds
          qc.setQueryData<ResearchResponse>(key, {
            research: prev.research.map(r =>
              r.id === researchId ? { ...r, inQueue: { level: r.level + 1, startedAt: Math.floor(Date.now() / 1000), finishesAt } } : r
            ),
          })
        }
      }

      return { prev }
    },

    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData<ResearchResponse>(key, context.prev)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['research'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
