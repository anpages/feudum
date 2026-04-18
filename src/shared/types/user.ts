export interface AuthUser {
  id: number
  username: string | null
  isAdmin?: boolean
  ether?: number
}

export interface UserProfile {
  id: number
  username: string | null
  email: string
  avatarUrl: string | null
  createdAt: string
}
