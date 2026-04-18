import { http } from '@/shared/services/http'
import type { BarracksResponse, TrainUnitResponse } from '../types'

export const barracksService = {
  getAll: () => http.get<BarracksResponse>('/barracks'),
  train: (unit: string, amount: number) =>
    http.post<TrainUnitResponse>('/barracks/train', { unit, amount }),
}
