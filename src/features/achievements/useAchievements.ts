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
    staleTime: 30_000,
  })
}

export function useClaimAchievement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (achievementId: string) => achievementsService.claim(achievementId),
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
    onError: () => toast.error('No se pudo reclamar el logro'),
  })
}

export function usePendingClaimsCount(): number {
  const { data } = useQuery({
    queryKey: ['achievements'],
    queryFn:  achievementsService.getAll,
    staleTime: 30_000,
  })
  return data?.pendingCount ?? 0
}
