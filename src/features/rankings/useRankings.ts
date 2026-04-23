import { useQuery } from '@tanstack/react-query'
import { rankingsService } from './services/rankingsService'
import type { RankingCategory, RankingEntry, RankingsResponse } from './types'

export type { RankingCategory, RankingEntry, RankingsResponse }

export function useRankings(category: RankingCategory = 'total') {
  return useQuery({
    queryKey: ['rankings', category],
    queryFn: () => rankingsService.getAll(category),
    staleTime: 60_000,
  })
}
