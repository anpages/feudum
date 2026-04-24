import { http } from '@/shared/services/http'
import type { AdminSettings, AdminUser, AdminMission, AdminBattlesResponse, AdminExpeditionsResponse, NpcProfileResponse, NpcStatsResponse, NpcDecisionsResponse, AdminSpyResponse, AdminScavengeResponse } from '../types'

export const adminService = {
  getSettings: () => http.get<AdminSettings>('/admin/settings'),
  getUsers: () => http.get<{ users: AdminUser[] }>('/admin/users'),
  getFleet: () => http.get<{ missions: AdminMission[]; now: number }>('/admin/fleet'),
  updateSettings: (patch: Partial<AdminSettings>) =>
    http.patch<AdminSettings>('/admin/settings', patch),
  toggleAdmin: (userId: string, isAdmin: boolean) =>
    http.patch<{ ok: boolean }>('/admin/users', { userId, isAdmin }),
  deleteUser: (userId: string) =>
    http.delete<{ ok: boolean }>(`/admin/users?userId=${userId}`),
  devAction: (body: Record<string, unknown>) => http.post<{ ok: boolean }>('/admin/dev', body),
  fastForward: (body: { missionId?: string; all?: boolean }) =>
    http.post<{ ok: boolean }>('/admin/fleet', body),
  seedNpcs: (params: { level1: number; level2: number; level3: number }) =>
    http.post<{ ok: boolean; created: number; deleted: number; byLevel: Record<string, number> }>(
      '/admin/seed-npcs',
      { action: 'seed_npcs', ...params },
    ),
  resetNpcs: () =>
    http.post<{ ok: boolean; deleted: number }>('/admin/seed-npcs', { action: 'reset_npcs' }),
  addNpc: () =>
    http.post<{ ok: boolean; created: number }>('/admin/seed-npcs', { action: 'add_one_npc' }),
  getBattles: (params?: { type?: string; page?: number }) => {
    const qs = new URLSearchParams()
    if (params?.type)  qs.set('type', params.type)
    if (params?.page)  qs.set('page', String(params.page))
    return http.get<AdminBattlesResponse>(`/admin/battles?${qs}`)
  },
  getExpeditions: () => http.get<AdminExpeditionsResponse>('/admin/expeditions'),
  getNpcProfile: (realm: number, region: number, slot: number) =>
    http.get<NpcProfileResponse>(`/admin/npc-profile?realm=${realm}&region=${region}&slot=${slot}`),
  getNpcStats: () => http.get<NpcStatsResponse>('/admin/npc-stats'),
  getNpcDecisions: (filter?: string) =>
    http.get<NpcDecisionsResponse>(`/admin/npc-decisions${filter && filter !== 'all' ? `?filter=${filter}` : ''}`),
  getSpyMissions:      () => http.get<AdminSpyResponse>('/admin/spy-missions'),
  getScavengeMissions: () => http.get<AdminScavengeResponse>('/admin/scavenge-missions'),
}
