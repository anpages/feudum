export interface AuthUser {
  id: number
  username: string | null
  isAdmin?: boolean
  ether?: number
  characterClass?: string | null
}

export interface UserProfile {
  id: number
  username: string | null
  email: string
  avatarUrl: string | null
  createdAt: string
}
