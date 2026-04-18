export interface AdminSettings {
  economy_speed: number
  research_speed: number
  fleet_speed_war: number
  fleet_speed_peaceful: number
  basic_wood: number
  basic_stone: number
}

export interface AdminUser {
  id: number
  username: string | null
  email: string
  isAdmin: boolean
  isNpc: boolean
  createdAt: string
  kingdomId: number | null
  kingdom: { id: number; realm: number; region: number; slot: number } | null
}

export interface AdminMission {
  id: number
  userId: number
  username: string | null
  missionType: string
  state: string
  arrivalTime: number
  returnTime: number | null
  targetRealm: number
  targetRegion: number
  targetSlot: number
}
