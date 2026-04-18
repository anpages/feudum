import { http } from '@/shared/services/http'
import type { KingdomSummary } from '@/shared/types'
import type { Kingdom } from '@/../db/schema'

export const kingdomService = {
  getMe: (id?: number | null) => http.get<Kingdom>(id ? `/kingdoms/me?id=${id}` : '/kingdoms/me'),
  getAll: () => http.get<{ kingdoms: KingdomSummary[] }>('/kingdoms'),
}
