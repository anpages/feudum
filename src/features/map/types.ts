export interface MapSlot {
  slot: number
  kingdomId: number | null
  name: string | null
  username: string | null
  isPlayer: boolean
  isNpc: boolean
  points: number
  isEmpty: boolean
  terrain: string | null
  debris: { wood: number; stone: number } | null
}

export interface MapResponse {
  realm: number
  region: number
  maxRealm: number
  maxRegion: number
  myPosition: { realm: number; region: number; slot: number } | null
  slots: MapSlot[]
}
