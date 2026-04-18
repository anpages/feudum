import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { messagesService } from './services/messagesService'
import type { GameMessage, MessagesResponse } from './types'

export type { GameMessage, MessagesResponse }

export function useMessages() {
  return useQuery({
    queryKey: ['messages'],
    queryFn: messagesService.getAll,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: messagesService.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { to: string; subject: string; body: string }) =>
      messagesService.send(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  })
}

export function useUnreadCount() {
  const { data } = useMessages()
  return data?.messages.filter(m => !m.viewed).length ?? 0
}
