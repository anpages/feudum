export interface AuthUser {
  id: number
  username: string | null
  isAdmin?: boolean
}

export interface UserProfile {
  id: number
  username: string | null
  email: string
  avatarUrl: string | null
  createdAt: string
}
