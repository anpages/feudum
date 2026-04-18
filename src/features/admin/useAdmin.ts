import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface AdminSettings {
  economy_speed: number
  research_speed: number
  fleet_speed_war: number
  fleet_speed_peaceful: number
  basic_wood: number
  basic_stone: number
}

export interface AdminUser {
  id: number
  username: string | null
  email: string
  isAdmin: boolean
  createdAt: string
  kingdomId: number | null
  kingdom: { id: number; realm: number; region: number; slot: number } | null
}

export interface AdminMission {
  id: number
  userId: number
  username: string | null
  missionType: string
  state: string
  arrivalTime: number
  returnTime: number | null
  targetRealm: number
  targetRegion: number
  targetSlot: number
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn:  () => api.get<AdminSettings>('/admin/settings'),
    staleTime: 10_000,
    retry: false,
  })
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn:  () => api.get<{ users: AdminUser[] }>('/admin/users'),
    staleTime: 10_000,
    retry: false,
  })
}

export function useAdminFleet() {
  return useQuery({
    queryKey: ['admin', 'fleet'],
    queryFn:  () => api.get<{ missions: AdminMission[]; now: number }>('/admin/fleet'),
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: false,
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<AdminSettings>) =>
      api.patch<AdminSettings>('/admin/settings', patch),
    onSuccess: data => qc.setQueryData(['admin', 'settings'], data),
  })
}

export function useToggleAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, isAdmin }: { userId: number; isAdmin: boolean }) =>
      api.patch<{ ok: boolean }>('/admin/users', { userId, isAdmin }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useDevAction() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<{ ok: boolean }>('/admin/dev', body),
  })
}

export function useFastForward() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { missionId?: number; all?: boolean }) =>
      api.post<{ ok: boolean }>('/admin/fleet', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'fleet'] }),
  })
}
