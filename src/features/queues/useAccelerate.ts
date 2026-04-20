import { useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/shared/services/http'
import { toast } from '@/lib/toast'

type QueueType = 'building' | 'research' | 'unit'

interface AccelerateResponse {
  ok: boolean
  finishesAt: number
  etherCost: number
  etherRemaining: number
}

export function useAccelerate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (queueType: QueueType) =>
      http.post<AccelerateResponse>('/queues/accelerate', { queueType }),

    onSuccess: (data, queueType) => {
      toast.success(`⚡ Cola acelerada · −${data.etherCost} Éter (te quedan ${data.etherRemaining})`)
      qc.invalidateQueries({ queryKey: [queueType === 'building' ? 'buildings' : queueType === 'research' ? 'research' : 'barracks'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
      qc.invalidateQueries({ queryKey: ['auth', 'profile'] })
    },

    onError: (err: Error) => {
      toast.error(err.message ?? 'Error al acelerar')
    },
  })
}
