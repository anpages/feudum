import { supabase } from '@/lib/supabase'
import { ACHIEVEMENTS } from '@/lib/game/achievements'
import type { Achievement, AchievementsResponse } from '../types'

export const achievementsService = {
  async getAll(): Promise<AchievementsResponse> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const { data, error } = await supabase
      .from('user_achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', user.id)
    if (error) throw error

    const unlockedMap = new Map<string, string>(
      (data ?? []).map(r => [r.achievement_id as string, r.unlocked_at as string]),
    )

    const achievements: Achievement[] = (ACHIEVEMENTS as Achievement[]).map(a => ({
      ...a,
      unlocked:   unlockedMap.has(a.id),
      unlockedAt: unlockedMap.get(a.id) ?? null,
      isNew:      false,
    }))

    return { achievements, newlyUnlocked: [] }
  },
}
