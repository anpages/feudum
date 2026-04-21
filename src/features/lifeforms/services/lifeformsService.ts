import { http } from '@/shared/services/http'
import type { LifeformsResponse, CivilizationId } from '../types'

export const lifeformsService = {
  getAll: () => http.get<LifeformsResponse>('/lifeforms'),
  selectCivilization: (civilization: CivilizationId) =>
    http.post<{ ok: boolean; civilization: CivilizationId }>('/lifeforms/select', { civilization }),
  buildBuilding: (building: string) =>
    http.post<{ ok: boolean; building: string; level: number; finishesAt: number; timeSeconds: number }>('/lifeforms/build', { building }),
  researchTech: (research: string) =>
    http.post<{ ok: boolean; research: string; level: number; finishesAt: number; timeSeconds: number }>('/lifeforms/research', { research }),
}
