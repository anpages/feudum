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
  kingdomId: string
  name: string
  username: string | null
  realm: number
  region: number
  slot: number
  isNpc: boolean
  npcLevel: number | null
  points: number
  breakdown: RankingBreakdown
  isMe: boolean
}

export interface RankingsResponse {
  rankings: RankingEntry[]
  category: RankingCategory
}
