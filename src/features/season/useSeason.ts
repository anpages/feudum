import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { seasonService } from './services/seasonService'

export function useSeason() {
  return useQuery({
    queryKey: ['season'],
    queryFn:  seasonService.getSeason,
    staleTime: 5 * 60_000,  // season data barely changes
  })
}

export function useAdminStartSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: seasonService.adminStartSeason,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['season'] }),
  })
}

export function useAdminEndSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ winnerUserId, condition }: { winnerUserId?: number; condition?: string }) =>
      seasonService.adminEndSeason(winnerUserId, condition),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['season'] }),
  })
}

export function useAdminCleanSessionData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: seasonService.adminCleanSessionData,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'battles'] }),
  })
}

export function useSeasonSummary() {
  return useQuery({
    queryKey: ['season', 'summary'],
    queryFn:  seasonService.getSummary,
    staleTime: 2 * 60_000,
  })
}

export function useSeasonHistory() {
  return useQuery({
    queryKey: ['season', 'history'],
    queryFn:  seasonService.getHistory,
    staleTime: 5 * 60_000,
  })
}

export function useJoinSeason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: seasonService.joinSeason,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['kingdoms'] })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
  })
}
