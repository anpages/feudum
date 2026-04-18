import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/lib/auth'

const ME_KEY = ['auth', 'me'] as const

export function useAuth() {
  const qc = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ME_KEY,
    queryFn:  authApi.me,
    retry:    false,
    staleTime: Infinity,
    refetchInterval: false,
  })

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess:  () => {
      qc.setQueryData(ME_KEY, null)
      qc.clear()
    },
  })

  return {
    user,
    isAuthenticated:  !!user,
    isLoading,
    signInWithGoogle: authApi.signInWithGoogle,
    logout,
  }
}
