import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { achievementsService } from './services/achievementsService'
import type { Achievement, AchievementsResponse } from './types'
import { toast } from '@/lib/toast'
import { formatResource } from '@/lib/format'

export type { Achievement, AchievementsResponse }

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn:  achievementsService.getAll,
    staleTime:       10_000,
    refetchInterval: 30_000,
  })
}

export function useClaimAchievement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (achievementId: string) => achievementsService.claim(achievementId),

    onMutate: async (achievementId: string) => {
      await qc.cancelQueries({ queryKey: ['achievements'] })
      const prev = qc.getQueryData<AchievementsResponse>(['achievements'])
      if (prev) {
        qc.setQueryData<AchievementsResponse>(['achievements'], {
          achievements: prev.achievements.map(a =>
            a.id === achievementId
              ? { ...a, pending: false, claimedAt: new Date().toISOString() }
              : a
          ),
          pendingCount: Math.max(0, prev.pendingCount - 1),
        })
      }
      return { prev }
    },

    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData<AchievementsResponse>(['achievements'], context.prev)
      toast.error('No se pudo reclamar el logro')
    },

    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['achievements'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
      if (data.reward) {
        const r = data.reward
        const parts = [
          r.wood  > 0 ? formatResource(r.wood)  + ' madera'  : '',
          r.stone > 0 ? formatResource(r.stone) + ' piedra' : '',
          r.grain > 0 ? formatResource(r.grain) + ' grano'  : '',
        ].filter(Boolean)
        if (parts.length) toast.success('Recompensa recibida: ' + parts.join(', '))
      }
    },
  })
}

export function usePendingClaimsCount(): number {
  const { data } = useQuery({
    queryKey: ['achievements'],
    queryFn:  achievementsService.getAll,
    staleTime: 10_000,
  })
  return data?.pendingCount ?? 0
}
