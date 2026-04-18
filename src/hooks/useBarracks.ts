import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

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
  return useQuery({
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
