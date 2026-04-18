import { http } from '@/shared/services/http'

export interface ResourceSettings {
  sawmillPercent:   number
  quarryPercent:    number
  grainFarmPercent: number
  windmillPercent:  number
  cathedralPercent: number
}

export const resourcesService = {
  getSettings:    (id?: number) => http.get<ResourceSettings>(`/resources/settings${id ? `?id=${id}` : ''}`),
  updateSettings: (patch: Partial<ResourceSettings>, id?: number) =>
    http.patch<ResourceSettings & { ok: boolean }>(`/resources/settings${id ? `?id=${id}` : ''}`, patch),
}
