import { api } from './api'

export interface AuthUser {
  id: number
  username: string | null
  needsNickname?: boolean
}

export const authApi = {
  me:               () => api.get<AuthUser>('/auth/me'),
  logout:           () => api.post<{ ok: boolean }>('/auth/logout', {}),
  signInWithGoogle: () => {
    const redirectUri = `${window.location.origin}/api/auth/google/callback`
    const params = new URLSearchParams({
      client_id:     '970424961254-50ggo1vi5b3jrvht5uoolkv9gnvsfkvn.apps.googleusercontent.com',
      redirect_uri:  redirectUri,
      response_type: 'code',
      scope:         'openid email profile',
      prompt:        'select_account',
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  },

  setNickname: (nickname: string) =>
    api.post<{ ok: boolean }>('/users/nickname', { nickname }),
}
