import { http } from '@/shared/services/http'
import type { UserProfile } from '@/shared/types'

export const profileService = {
  getMe:           () => http.get<UserProfile>('/users/me'),
  update:          (username: string) => http.patch<UserProfile>('/users/me', { username }),
  setClass:        (characterClass: string) => http.post<{ ok: boolean; characterClass: string; ether: number; cost: number }>('/users/class', { characterClass }),
  renameKingdom:   (name: string, id?: number) => http.patch<{ ok: boolean; name: string }>('/kingdoms/me', { name, id }),
  abandonKingdom:  (id: number) => http.delete<{ ok: boolean }>(`/kingdoms/me?id=${id}`),
}
