import { http } from '@/shared/services/http'
import type { AchievementsResponse } from '../types'

export const achievementsService = {
  getAll: (): Promise<AchievementsResponse> =>
    http.get<AchievementsResponse>('/api/achievements'),

  claim: (achievementId: string): Promise<{ ok: boolean; reward: { wood: number; stone: number; grain: number } | null }> =>
    http.post('/api/achievements/claim', { achievementId }),
}
