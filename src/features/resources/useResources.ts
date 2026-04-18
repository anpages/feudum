import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { resourcesService, type ResourceSettings } from './services/resourcesService'
import { getActiveKingdomId } from '@/features/kingdom/useKingdom'
import { toast } from '@/lib/toast'

export type { ResourceSettings }

export function useResourceSettings() {
  const id = getActiveKingdomId() ?? undefined
  return useQuery({
    queryKey: ['resources', 'settings', id],
    queryFn: () => resourcesService.getSettings(id),
    staleTime: 30_000,
  })
}

export function useUpdateResourceSettings() {
  const qc = useQueryClient()
  const id = getActiveKingdomId() ?? undefined

  return useMutation({
    mutationFn: (patch: Partial<ResourceSettings>) => resourcesService.updateSettings(patch, id),
    onSuccess: data => {
      qc.setQueryData(['resources', 'settings', id], data)
      qc.invalidateQueries({ queryKey: ['kingdom'] })
      toast.success('Ajustes guardados')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
