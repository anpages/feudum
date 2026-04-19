import { useQuery } from '@tanstack/react-query'
import { rankingsService } from './services/rankingsService'
import type { RankingCategory, RankingEntry, RankingPlayerType, RankingsResponse } from './types'

export type { RankingCategory, RankingEntry, RankingPlayerType, RankingsResponse }

export function useRankings(category: RankingCategory = 'total', playerType: RankingPlayerType = 'players') {
  return useQuery({
    queryKey: ['rankings', category, playerType],
    queryFn: () => rankingsService.getAll(category, playerType),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
