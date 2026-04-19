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
