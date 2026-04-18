import { http } from '@/shared/services/http'
import type { UserProfile } from '@/shared/types'

export const profileService = {
  getMe: () => http.get<UserProfile>('/users/me'),
  update: (username: string) => http.patch<UserProfile>('/users/me', { username }),
}
