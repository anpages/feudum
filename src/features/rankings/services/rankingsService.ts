import { http } from '@/shared/services/http'
import type { RankingCategory, RankingPlayerType, RankingsResponse } from '../types'

export const rankingsService = {
  getAll: (category: RankingCategory = 'total', playerType: RankingPlayerType = 'players') =>
    http.get<RankingsResponse>(`/rankings?category=${category}&type=${playerType}`),
}
