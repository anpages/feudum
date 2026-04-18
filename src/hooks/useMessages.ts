import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface GameMessage {
  id:        number
  type:      string   // 'battle' | 'spy' | 'system'
  subject:   string
  data:      Record<string, unknown>
  viewed:    boolean
  createdAt: string
}

interface MessagesResponse {
  messages: GameMessage[]
}

export function useMessages() {
  return useQuery({
    queryKey:        ['messages'],
    queryFn:         () => api.get<MessagesResponse>('/messages'),
    staleTime:       15_000,
    refetchInterval: 30_000,
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.patch('/messages', {}),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['messages'] }),
  })
}

export function useUnreadCount() {
  const { data } = useMessages()
  return data?.messages.filter(m => !m.viewed).length ?? 0
}
