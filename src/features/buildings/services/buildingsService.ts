import { http } from '@/shared/services/http'
import type { BuildingsResponse, UpgradeBuildingResponse } from '../types'

export const buildingsService = {
  getAll: () => http.get<BuildingsResponse>('/buildings'),
  upgrade: (buildingId: string) =>
    http.post<UpgradeBuildingResponse>('/buildings/upgrade', { building: buildingId }),
}
