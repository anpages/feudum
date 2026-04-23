import { useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { barracksService } from './services/barracksService'
import { getActiveKingdomId } from '@/features/kingdom/useKingdom'
import { toast } from '@/lib/toast'
import { UNIT_LABELS } from '@/lib/labels'
import type { UnitInfo, BarracksResponse } from './types'

export type { UnitInfo, BarracksResponse }

export function useBarracks() {
  const prevRef = useRef<UnitInfo[] | null>(null)
  const activeId = getActiveKingdomId()

  const result = useQuery({
    queryKey: ['barracks', activeId],
    queryFn: () => barracksService.getAll(activeId),
  })

  useEffect(() => {
    if (!result.data) return
    const all = [...result.data.units, ...result.data.support, ...result.data.defenses, ...(result.data.missiles ?? [])]
    if (prevRef.current) {
      for (const u of all) {
        const prev = prevRef.current.find(p => p.id === u.id)
        if (prev?.inQueue && !u.inQueue) {
          toast.success(`${UNIT_LABELS[u.id] ?? u.id} — entrenamiento completado`)
        }
      }
    }
    prevRef.current = all
  }, [result.data])

  return result
}

export function useTrainUnit() {
  const qc = useQueryClient()
  const activeId = getActiveKingdomId()
  const key = ['barracks', activeId] as const

  return useMutation({
    mutationKey: ['mutate', 'unit'],
    mutationFn: ({ unit, amount }: { unit: string; amount: number }) =>
      barracksService.train(unit, amount, activeId),

    onMutate: async ({ unit, amount }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<BarracksResponse>(key)

      if (prev) {
        const findAndUpdate = (list: UnitInfo[]) =>
          list.map(u => {
            if (u.id !== unit) return u
            const timeSecs = u.timePerUnit * amount
            const finishesAt = Math.floor(Date.now() / 1000) + timeSecs
            return { ...u, inQueue: { amount, finishesAt } }
          })

        qc.setQueryData<BarracksResponse>(key, {
          units: findAndUpdate(prev.units),
          support: findAndUpdate(prev.support),
          defenses: findAndUpdate(prev.defenses),
          missiles: findAndUpdate(prev.missiles ?? []),
        })
      }

      return { prev }
    },

    onSuccess: (data, { unit }) => {
      if (!data?.finishesAt) return
      qc.setQueryData<BarracksResponse>(key, (prev) => {
        if (!prev) return prev
        const fix = (list: UnitInfo[]) =>
          list.map(u => u.id === unit && u.inQueue ? { ...u, inQueue: { ...u.inQueue, finishesAt: data.finishesAt } } : u)
        return { units: fix(prev.units), support: fix(prev.support), defenses: fix(prev.defenses), missiles: fix(prev.missiles ?? []) }
      })
    },

    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData<BarracksResponse>(key, context.prev)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['barracks'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
