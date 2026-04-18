import { useQuery } from '@tanstack/react-query'
import { rankingsService } from './services/rankingsService'
import type { RankingEntry, RankingsResponse } from './types'

export type { RankingEntry, RankingsResponse }

export function useRankings() {
  return useQuery({
    queryKey: ['rankings'],
    queryFn: rankingsService.getAll,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
