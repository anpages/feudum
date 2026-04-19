export type AchievementCategory = 'buildings' | 'research' | 'military' | 'combat' | 'explore' | 'season'

export interface Achievement {
  id: string
  cat: AchievementCategory
  name: string
  desc: string
  icon: string
  unlocked: boolean
  unlockedAt: string | null
  isNew: boolean
}

export interface AchievementsResponse {
  achievements: Achievement[]
  newlyUnlocked: string[]
}
