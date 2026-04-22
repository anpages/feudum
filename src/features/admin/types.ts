export interface AdminSettings {
  economy_speed: number
  research_speed: number
  fleet_speed_war: number
  fleet_speed_peaceful: number
  basic_wood: number
  basic_stone: number
}

export interface AdminUser {
  id: string
  username: string | null
  email: string
  isAdmin: boolean
  isNpc: boolean
  createdAt: string
  kingdomId: string | null
  kingdom: { id: string; realm: number; region: number; slot: number } | null
}

export interface AdminBattleLog {
  id: string
  attackerKingdomId: string | null
  attackerName: string
  attackerIsNpc: boolean
  defenderKingdomId: string | null
  defenderName: string
  defenderIsNpc: boolean
  missionType: string
  outcome: string
  lootWood: number
  lootStone: number
  lootGrain: number
  attackerLosses: number
  defenderLosses: number
  rounds: number
  attackerCoord: string
  defenderCoord: string
  createdAt: string
}

export interface AdminBattlesResponse {
  battles: AdminBattleLog[]
  metrics: {
    total24h: number
    npcVsNpc24h: number
    npcVsPlayer24h: number
    playerVsNpc24h: number
    playerVsPlayer24h: number
    totalLoot24h: { wood: number; stone: number; grain: number }
  }
  page: number
  limit: number
}

export interface AdminMission {
  id: string
  userId: string
  username: string | null
  missionType: string
  state: string
  arrivalTime: number
  returnTime: number | null
  targetRealm: number
  targetRegion: number
  targetSlot: number
}

export interface AdminExpedition {
  id: string
  userId: string
  state: string
  startRealm: number
  startRegion: number
  startSlot: number
  targetRealm: number
  targetRegion: number
  targetSlot: number
  departureTime: number
  arrivalTime: number
  holdingTime: number | null
  returnTime: number | null
  woodLoad: number | null
  stoneLoad: number | null
  grainLoad: number | null
  result: Record<string, unknown> | null
  kingdomName: string
  isNpc: boolean
}

export interface AdminExpeditionsResponse {
  active: AdminExpedition[]
  recent: AdminExpedition[]
  depletion: Record<string, { count: number; factor: number }>
  stats: {
    active24h: number
    byRegion: Record<string, { count: number; factor: number }>
    npcCount: number
    playerCount: number
  }
  now: number
}
