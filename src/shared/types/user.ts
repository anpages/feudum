export interface AuthUser {
  id: string
  username: string | null
  isAdmin?: boolean
  ether?: number
  characterClass?: string | null
}

export interface UserProfile {
  id: string
  username: string | null
  email: string
  avatarUrl: string | null
  createdAt: string
}
