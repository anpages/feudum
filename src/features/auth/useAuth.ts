import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { authService } from './services/authService'

const ME_KEY = ['auth', 'me'] as const

export function useAuth() {
  const qc = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ME_KEY,
    queryFn: authService.me,
    retry: false,
    staleTime: Infinity,
    refetchInterval: false,
  })

  // Sync React Query with Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        qc.setQueryData(ME_KEY, null)
        qc.clear()
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        qc.invalidateQueries({ queryKey: ME_KEY })
      }
    })
    return () => subscription.unsubscribe()
  }, [qc])

  const logout = async () => {
    await authService.logout()
    qc.setQueryData(ME_KEY, null)
    qc.clear()
  }

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    signInWithGoogle: authService.signInWithGoogle,
    logout,
  }
}
