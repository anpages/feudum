import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profileService } from './services/profileService'
import type { UserProfile } from '@/shared/types'

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
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}
