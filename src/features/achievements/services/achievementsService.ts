import { http } from '@/shared/services/http'
import type { AchievementsResponse } from '../types'

export const achievementsService = {
  getAll: () => http.get<AchievementsResponse>('/achievements'),
}
