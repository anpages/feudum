import { useQuery } from '@tanstack/react-query'
import { achievementsService } from './services/achievementsService'
import type { Achievement, AchievementsResponse } from './types'

export type { Achievement, AchievementsResponse }

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: achievementsService.getAll,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
