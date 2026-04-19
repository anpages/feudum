import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { http } from '@/shared/services/http'

/**
 * Returns a callback that asks the server to apply every completed queue row
 * (buildings/units/research) for the current user, then invalidates the
 * kingdom query so the resource bar picks up the new productions.
 *
 * Designed to be called from a countdown's `onCountdownEnd` — the server
 * deletes the processed queue rows, which triggers the realtime DELETE
 * push that already invalidates per-feature queues elsewhere.
 */
export function useQueueSync() {
  const qc = useQueryClient()
  return useCallback(async () => {
    try {
      await http.post<{ processed: number }>('/queues/sync', {})
    } catch {
      /* swallow — realtime + next mutation will reconcile */
    }
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }, [qc])
}
