export interface RankingEntry {
  rank: number
  kingdomId: number
  name: string
  username: string
  realm: number
  region: number
  slot: number
  points: number
  isMe: boolean
}

export interface RankingsResponse {
  rankings: RankingEntry[]
}
