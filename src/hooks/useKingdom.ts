import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Kingdom } from '../../db/schema'

export function useKingdom() {
  return useQuery({
    queryKey:        ['kingdom'],
    queryFn:         () => api.get<Kingdom>('/kingdoms/me'),
    staleTime:       5_000,
    refetchInterval: 10_000,
  })
}
