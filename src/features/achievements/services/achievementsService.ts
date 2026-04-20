import { supabase } from '@/lib/supabase'
import { ACHIEVEMENTS } from '@/lib/game/achievements'
import type { Achievement, AchievementsResponse } from '../types'

const SEEN_KEY = 'achievements_seen_at'

export const achievementsService = {
  async getAll(): Promise<AchievementsResponse> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data, error } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', user.id)
    if (error) throw error

    const seenAt = localStorage.getItem(SEEN_KEY)
    const seenDate = seenAt ? new Date(seenAt) : null

    const unlockedMap = new Map<string, string>(
      (data ?? []).map(r => [r.achievement_id as string, r.unlocked_at as string]),
    )

    const achievements: Achievement[] = (ACHIEVEMENTS as Achievement[]).map(a => {
      const unlockedAt = unlockedMap.get(a.id) ?? null
      const isNew = !!unlockedAt && (!seenDate || new Date(unlockedAt) > seenDate)
      return { ...a, unlocked: unlockedMap.has(a.id), unlockedAt, isNew }
    })

    const newlyUnlocked = achievements.filter(a => a.isNew).map(a => a.id)

    return { achievements, newlyUnlocked }
  },

  markSeen() {
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
  },
}
