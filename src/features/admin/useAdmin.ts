import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminService } from './services/adminService'
import type { AdminSettings, AdminUser, AdminMission } from './types'

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
    refetchInterval: 10_000,
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
    mutationFn: ({ userId, isAdmin }: { userId: number; isAdmin: boolean }) =>
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
    mutationFn: (body: { missionId?: number; all?: boolean }) => adminService.fastForward(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'fleet'] }),
  })
}
