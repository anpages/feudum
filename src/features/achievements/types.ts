export type AchievementCategory =
  | 'inicio'
  | 'economia'
  | 'infraestructura'
  | 'investigacion'
  | 'ejercito'
  | 'combate'
  | 'expansion'
  | 'temporada'

export interface Achievement {
  id: string
  cat: AchievementCategory
  order: number
  name: string
  desc: string
  icon: string
  reward?: { wood: number; stone: number; grain: number }
  unlocked:   boolean
  unlockedAt: string | null
  claimedAt:  string | null
  pending:    boolean
}

export interface AchievementsResponse {
  achievements: Achievement[]
  pendingCount: number
}
