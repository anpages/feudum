import { supabase } from '@/lib/supabase'
import { http } from '@/shared/services/http'
import type { AuthUser } from '@/shared/types'

export const authService = {
  me: () => http.get<AuthUser>('/auth/me'),

  logout: async () => {
    await supabase.auth.signOut({ scope: 'local' })
    return { ok: true }
  },

  setNickname: (nickname: string) => http.post<{ ok: boolean }>('/users/nickname', { nickname }),

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
  },
}
