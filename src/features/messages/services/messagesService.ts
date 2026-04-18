import { http } from '@/shared/services/http'
import type { MessagesResponse } from '../types'

export const messagesService = {
  getAll: () => http.get<MessagesResponse>('/messages'),
  markAllRead: () => http.patch<{ ok: boolean }>('/messages', {}),
  send: (params: { to: string; subject: string; body: string }) =>
    http.post<{ ok: boolean }>('/messages/send', params),
}
