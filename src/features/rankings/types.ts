export type RankingCategory = 'total' | 'buildings' | 'research' | 'units' | 'economy'

export interface RankingBreakdown {
  total: number
  buildings: number
  research: number
  units: number
  economy: number
}

export interface RankingEntry {
  rank: number
  kingdomId: number
  name: string
  username: string | null
  realm: number
  region: number
  slot: number
  isNpc: boolean
  points: number
  breakdown: RankingBreakdown
  isMe: boolean
}

export interface RankingsResponse {
  rankings: RankingEntry[]
  category: RankingCategory
}
