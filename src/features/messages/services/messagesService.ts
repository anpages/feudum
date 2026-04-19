import { http } from '@/shared/services/http'
import { supabase } from '@/lib/supabase'
import type { GameMessage, MessagesResponse } from '../types'

export const messagesService = {
  async getAll(): Promise<MessagesResponse> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data, error } = await supabase
      .from('messages')
      .select('id, type, subject, data, viewed, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error

    const messages: GameMessage[] = (data ?? []).map(m => ({
      id:        m.id as string,
      type:      m.type as string,
      subject:   m.subject as string,
      data:      typeof m.data === 'string' ? JSON.parse(m.data) : (m.data ?? {}),
      viewed:    m.viewed as boolean,
      createdAt: m.created_at as string,
    }))

    return { messages }
  },

  async markAllRead(): Promise<{ ok: boolean }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')
    const { error } = await supabase.from('messages').update({ viewed: true }).eq('user_id', user.id)
    if (error) throw error
    return { ok: true }
  },

  send: (params: { to: string; subject: string; body: string }) =>
    http.post<{ ok: boolean }>('/messages/send', params),
}
