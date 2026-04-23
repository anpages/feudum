import { http } from '@/shared/services/http'
import type { RankingCategory, RankingsResponse } from '../types'

export const rankingsService = {
  getAll: (category: RankingCategory = 'total') =>
    http.get<RankingsResponse>(`/rankings?category=${category}`),
}
