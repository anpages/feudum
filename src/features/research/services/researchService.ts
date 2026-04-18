import { http } from '@/shared/services/http'
import type { ResearchResponse, UpgradeResearchResponse } from '../types'

export const researchService = {
  getAll: () => http.get<ResearchResponse>('/research'),
  upgrade: (researchId: string) =>
    http.post<UpgradeResearchResponse>('/research/upgrade', { research: researchId }),
}
