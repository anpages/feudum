export interface MapPoi {
  type: string
  label?: string
  magnitude: number
  claimed: boolean
}

export interface MapMyMission {
  type: string                 // 'attack' | 'spy' | 'expedition' | 'transport' | ...
  arrivalTime: number
  returnTime: number | null
  state: string                // 'active' | 'returning' | 'exploring' | 'merchant'
}

export interface MapSlot {
  slot: number
  kingdomId: string | null
  name: string | null
  username: string | null
  isPlayer: boolean
  isNpc: boolean
  isPrimary: boolean
  points: number
  isEmpty: boolean
  debris: { wood: number; stone: number } | null
  poi: MapPoi | null
  myMission: MapMyMission | null
}

export interface MapResponse {
  realm: number
  region: number
  maxRealm: number
  maxRegion: number
  myPosition: { realm: number; region: number; slot: number } | null
  slots: MapSlot[]
}
