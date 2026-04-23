export interface AuthUser {
  id: string
  username: string | null
  role?: string
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
