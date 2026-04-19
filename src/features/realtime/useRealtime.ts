import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/useAuth'

export function useRealtime() {
  const qc = useQueryClient()
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('game-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kingdoms' }, () => {
        qc.invalidateQueries({ queryKey: ['kingdom'] })
        qc.invalidateQueries({ queryKey: ['kingdoms'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'building_queue' }, () => {
        qc.invalidateQueries({ queryKey: ['buildings'] })
        qc.invalidateQueries({ queryKey: ['kingdom'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'research_queue' }, () => {
        qc.invalidateQueries({ queryKey: ['research'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_queue' }, () => {
        qc.invalidateQueries({ queryKey: ['barracks'] })
        qc.invalidateQueries({ queryKey: ['kingdom'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'army_missions' }, () => {
        qc.invalidateQueries({ queryKey: ['armies'] })
        qc.invalidateQueries({ queryKey: ['kingdom'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        qc.invalidateQueries({ queryKey: ['messages'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, qc])
}
