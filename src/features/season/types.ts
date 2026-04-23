export interface SeasonSummaryPlayer {
  userId?:        string
  username:       string | null
  rank:           number
  points:         number
  buildingPoints: number
  researchPoints: number
  unitPoints:     number
  achievementsCount?: number
  kingdomsCount?: number
  isMe?:          boolean
}

export interface SeasonSummaryData {
  seasonNumber: number
  seasonStart:  number
  seasonEnd:    number
  winner:       { id: string; username: string | null; condition: string } | null
  topPlayers:   SeasonSummaryPlayer[]
  mySnapshot:   SeasonSummaryPlayer | null
}

export interface SeasonSnapshot {
  id:               string
  userId:           string | null
  seasonNumber:     number
  username:         string | null
  rank:             number | null
  points:           number
  buildingPoints:   number
  researchPoints:   number
  unitPoints:       number
  achievementsCount: number
  kingdomsCount:    number
  createdAt:        string
}

export interface SeasonBoss {
  slug:       string
  name:       string
  difficulty: number
  lore:       string
  kingdom: {
    id: string; name: string
    realm: number; region: number; slot: number
    dragonKnight: number
  } | null
  armySize: number
}

export interface SeasonWinner {
  id:        string
  username:  string | null
  condition: string
}

export interface Season {
  active:        boolean
  seasonNumber:  number
  seasonState:   string | null
  seasonStart:   number
  seasonEnd:     number
  timeLeft:      number
  boss:          SeasonBoss | null
  winner:        SeasonWinner | null
}
