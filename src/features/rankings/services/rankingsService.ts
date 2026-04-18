import { http } from '@/shared/services/http'
import type { RankingsResponse } from '../types'

export const rankingsService = {
  getAll: () => http.get<RankingsResponse>('/rankings'),
}
