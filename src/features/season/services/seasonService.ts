import { http } from '@/shared/services/http'
import type { Season } from '../types'

export const seasonService = {
  getSeason: () => http.get<Season>('/api/season'),
  adminStartSeason: () => http.post('/api/admin/season', { action: 'start_season' }),
  adminEndSeason: (winnerUserId?: number, condition?: string) =>
    http.post('/api/admin/season', { action: 'end_season', winnerUserId, condition }),
}
