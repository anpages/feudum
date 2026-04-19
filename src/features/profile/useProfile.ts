import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileService } from './services/profileService'
import type { UserProfile } from '@/shared/types'
import { toast } from '@/lib/toast'

export type { UserProfile }

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: profileService.getMe,
    staleTime: 60_000,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (username: string) => profileService.update(username),
    onSuccess: data => {
      qc.setQueryData(['profile'], data)
      qc.invalidateQueries({ queryKey: ['auth', 'profile'] })
    },
  })
}

export function useSetClass() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (characterClass: string) => profileService.setClass(characterClass),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['auth', 'profile'] })
      if (data.cost > 0) {
        toast.success(`Clase cambiada · −${data.cost} Éter`)
      } else {
        toast.success('Clase seleccionada')
      }
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useRenameKingdom() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ name, id }: { name: string; id?: string }) => profileService.renameKingdom(name, id),
    onSuccess: data => {
      qc.invalidateQueries({ queryKey: ['kingdom'] })
      qc.invalidateQueries({ queryKey: ['kingdoms'] })
      toast.success(`Reino renombrado a "${data.name}"`)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}

export function useAbandonKingdom() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => profileService.abandonKingdom(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kingdom'] })
      qc.invalidateQueries({ queryKey: ['kingdoms'] })
      toast.success('Colonia abandonada')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })
}
