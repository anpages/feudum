import { useEffect, useRef } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { http } from '@/shared/services/http'
import { useAuth } from '@/features/auth/useAuth'

// Invalidate `key` only if no in-flight mutation guards it. This prevents
// realtime postgres events from clobbering an optimistic update before the
// mutation finishes (which would cause flicker / spurious rollbacks).
function safeInvalidate(qc: QueryClient, key: readonly unknown[], guard?: readonly unknown[]) {
  if (guard && qc.isMutating({ mutationKey: guard }) > 0) return
  qc.invalidateQueries({ queryKey: key })
}

export function useRealtime() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id
  const reconnecting = useRef(false)
  const initialized = useRef(false)

  useEffect(() => {
    if (!userId) return

    const uid = String(userId)

    const channel = supabase
      .channel(`game:${uid}`)

      // Kingdom row updates (resources, building levels, unit counts)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'kingdoms',
        filter: `user_id=eq.${uid}`,
      }, () => {
        safeInvalidate(qc, ['kingdom'])
        safeInvalidate(qc, ['kingdoms'])
      })

      // Building queue: only invalidate if no upgrade-building mutation is in flight
      .on('postgres_changes', { event: '*', schema: 'public', table: 'building_queue' }, () => {
        safeInvalidate(qc, ['buildings'], ['mutate', 'building'])
        safeInvalidate(qc, ['kingdom'], ['mutate', 'building'])
      })

      .on('postgres_changes', { event: '*', schema: 'public', table: 'research_queue' }, () => {
        safeInvalidate(qc, ['research'], ['mutate', 'research'])
      })

      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_queue' }, () => {
        safeInvalidate(qc, ['barracks'], ['mutate', 'unit'])
        safeInvalidate(qc, ['kingdom'], ['mutate', 'unit'])
      })

      .on('postgres_changes', { event: '*', schema: 'public', table: 'army_missions' }, () => {
        safeInvalidate(qc, ['armies'], ['mutate', 'army'])
        safeInvalidate(qc, ['kingdom'], ['mutate', 'army'])
      })

      // Scoped: user only receives their own messages and achievements
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `user_id=eq.${uid}`,
      }, () => {
        safeInvalidate(qc, ['messages'])
      })

      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'user_achievements',
        filter: `user_id=eq.${uid}`,
      }, () => {
        safeInvalidate(qc, ['achievements'])
      })

      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reconnecting.current = true
          return
        }
        if (status !== 'SUBSCRIBED') return

        // After (re)connect, refetch everything — events may have been missed
        // while offline. On the very first SUBSCRIBED we also re-pull so the
        // app is consistent in case any data shifted between mount and subscribe.
        if (reconnecting.current || !initialized.current) {
          reconnecting.current = false
          initialized.current = true
          // Apply any queues that finished while offline before re-pulling
          // (otherwise reads would see stale levels / zero productions).
          http.post<{ processed: number }>('/queues/sync', {})
            .catch(() => {})
            .finally(() => qc.invalidateQueries())
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId, qc])
}
