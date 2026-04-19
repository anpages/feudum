import { useQuery } from '@tanstack/react-query'
import { achievementsService } from './services/achievementsService'
import type { Achievement, AchievementsResponse } from './types'

export type { Achievement, AchievementsResponse }

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: achievementsService.getAll,
    staleTime: 60_000,  // Realtime on user_achievements INSERT handles live updates
  })
}
