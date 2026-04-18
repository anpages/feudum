import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface UserProfile {
  id: number
  username: string | null
  email: string
  avatarUrl: string | null
  createdAt: string
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<UserProfile>('/users/me'),
    staleTime: 60_000,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (username: string) =>
      api.patch<UserProfile>('/users/me', { username }),

    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}
