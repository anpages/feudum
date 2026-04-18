import { http } from '@/shared/services/http'
import type { MapResponse } from '../types'

export const mapService = {
  getRegion: (realm: number, region: number) =>
    http.get<MapResponse>(`/map?realm=${realm}&region=${region}`),
}
