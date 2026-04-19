import { http } from '@/shared/services/http'
import type { ArmiesResponse, SendArmyResponse, RecallArmyResponse } from '../types'
import type { SendArmyParams } from '@/shared/types'

export const armiesService = {
  getAll: () => http.get<ArmiesResponse>('/armies'),
  send: (params: SendArmyParams) => http.post<SendArmyResponse>('/armies/send', params),
  recall: (missionId: string) => http.post<RecallArmyResponse>('/armies/recall', { missionId }),
  merchantRespond: (missionId: string, accept: boolean) =>
    http.post<{ ok: boolean; accepted: boolean }>('/armies/merchant', { missionId, accept }),
}
