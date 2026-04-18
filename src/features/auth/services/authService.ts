import { http } from '@/shared/services/http'
import type { AuthUser } from '@/shared/types'

export const authService = {
  me: () => http.get<AuthUser>('/auth/me'),
  logout: () => http.post<{ ok: boolean }>('/auth/logout', {}),
  setNickname: (nickname: string) => http.post<{ ok: boolean }>('/users/nickname', { nickname }),

  signInWithGoogle: () => {
    const redirectUri = `${window.location.origin}/api/auth/google/callback`
    const params = new URLSearchParams({
      client_id: '970424961254-50ggo1vi5b3jrvht5uoolkv9gnvsfkvn.apps.googleusercontent.com',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  },
}
