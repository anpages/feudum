import { http } from '@/shared/services/http'
import type { AdminSettings, AdminUser, AdminMission } from '../types'

export const adminService = {
  getSettings: () => http.get<AdminSettings>('/admin/settings'),
  getUsers: () => http.get<{ users: AdminUser[] }>('/admin/users'),
  getFleet: () => http.get<{ missions: AdminMission[]; now: number }>('/admin/fleet'),
  updateSettings: (patch: Partial<AdminSettings>) =>
    http.patch<AdminSettings>('/admin/settings', patch),
  toggleAdmin: (userId: number, isAdmin: boolean) =>
    http.patch<{ ok: boolean }>('/admin/users', { userId, isAdmin }),
  devAction: (body: Record<string, unknown>) => http.post<{ ok: boolean }>('/admin/dev', body),
  fastForward: (body: { missionId?: number; all?: boolean }) =>
    http.post<{ ok: boolean }>('/admin/fleet', body),
  seedNpcs: () =>
    http.post<{ ok: boolean; created: number; deleted: number; npcUserId: number }>('/admin/seed-npcs', { action: 'seed_npcs' }),
}
