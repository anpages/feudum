import { useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from '@/lib/toast'
import { UNIT_LABELS } from '@/lib/labels'

export interface UnitInfo {
  id: string
  count: number
  woodBase: number
  stoneBase: number
  grainBase: number
  hull: number
  shield: number
  attack: number
  timePerUnit: number
  requiresMet: boolean
  requires: { type: 'building' | 'research'; id: string; level: number }[]
  inQueue: { amount: number; finishesAt: number } | null
}

export interface BarracksResponse {
  units:    UnitInfo[]
  support:  UnitInfo[]
  defenses: UnitInfo[]
}

export function useBarracks() {
  const prevRef = useRef<UnitInfo[] | null>(null)

  const result = useQuery({
    queryKey:  ['barracks'],
    queryFn:   () => api.get<BarracksResponse>('/barracks'),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const now = Math.floor(Date.now() / 1000)
      const all = [
        ...(query.state.data?.units    ?? []),
        ...(query.state.data?.support  ?? []),
        ...(query.state.data?.defenses ?? []),
      ]
      return all.some(u => u.inQueue && u.inQueue.finishesAt > now) ? 3_000 : 10_000
    },
  })

  useEffect(() => {
    if (!result.data) return
    const all = [...result.data.units, ...result.data.support, ...result.data.defenses]
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

  return useMutation({
    mutationFn: ({ unit, amount }: { unit: string; amount: number }) =>
      api.post<{ ok: boolean; finishesAt: number; timeSeconds: number }>(
        '/barracks/train', { unit, amount },
      ),

    onMutate: async ({ unit, amount }) => {
      await qc.cancelQueries({ queryKey: ['barracks'] })
      const prev = qc.getQueryData<BarracksResponse>(['barracks'])

      if (prev) {
        const findAndUpdate = (list: UnitInfo[]) =>
          list.map(u => {
            if (u.id !== unit) return u
            const timeSecs   = u.timePerUnit * amount
            const finishesAt = Math.floor(Date.now() / 1000) + timeSecs
            return { ...u, inQueue: { amount, finishesAt } }
          })

        qc.setQueryData<BarracksResponse>(['barracks'], {
          units:    findAndUpdate(prev.units),
          support:  findAndUpdate(prev.support),
          defenses: findAndUpdate(prev.defenses),
        })
      }

      return { prev }
    },

    onError: (_err, _vars, context) => {
      if (context?.prev) qc.setQueryData<BarracksResponse>(['barracks'], context.prev)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['barracks'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
