import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminService } from './services/adminService'
import type { AdminSettings, AdminUser, AdminMission, NpcDecisionsResponse } from './types'

export type { NpcDecisionsResponse }

export type { AdminSettings, AdminUser, AdminMission }

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: adminService.getSettings,
    staleTime: 10_000,
    retry: false,
  })
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: adminService.getUsers,
    staleTime: 10_000,
    retry: false,
  })
}

export function useAdminFleet() {
  return useQuery({
    queryKey: ['admin', 'fleet'],
    queryFn: adminService.getFleet,
    staleTime: 5_000,
    retry: false,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<AdminSettings>) => adminService.updateSettings(patch),
    onSuccess: data => qc.setQueryData(['admin', 'settings'], data),
  })
}

export function useToggleAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) =>
      adminService.toggleAdmin(userId, isAdmin),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useDevAction() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => adminService.devAction(body),
  })
}

export function useFastForward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { missionId?: string; all?: boolean }) => adminService.fastForward(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'fleet'] }),
  })
}

export function useSeedNpcs() {
  return useMutation({
    mutationFn: (params: { level1: number; level2: number; level3: number }) =>
      adminService.seedNpcs(params),
  })
}

export function useResetNpcs() {
  return useMutation({
    mutationFn: () => adminService.resetNpcs(),
  })
}

export function useNpcDecisions(filter: string) {
  return useQuery({
    queryKey: ['admin', 'npc-decisions', filter],
    queryFn: () => adminService.getNpcDecisions(filter),
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: false,
  })
}
