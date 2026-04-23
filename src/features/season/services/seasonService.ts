import { http } from '@/shared/services/http'
import type { Season } from '../types'

export const seasonService = {
  getSeason: () => http.get<Season>('/season'),
  adminStartSeason: () => http.post('/admin/season', { action: 'start_season' }),
  adminEndSeason: (winnerUserId?: number, condition?: string) =>
    http.post('/admin/season', { action: 'end_season', winnerUserId, condition }),
  adminCleanSessionData: () => http.post('/admin/season', { action: 'clean_session_data' }),
}
