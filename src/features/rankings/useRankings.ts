import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface RankingEntry {
  rank:      number
  kingdomId: number
  name:      string
  username:  string
  realm:     number
  region:    number
  slot:      number
  points:    number
  isMe:      boolean
}

export interface RankingsResponse {
  rankings: RankingEntry[]
}

export function useRankings() {
  return useQuery({
    queryKey:       ['rankings'],
    queryFn:        () => api.get<RankingsResponse>('/rankings'),
    staleTime:      30_000,
    refetchInterval: 60_000,
  })
}
