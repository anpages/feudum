export interface KingdomSummary {
  id: string
  name: string
  realm: number
  region: number
  slot: number
  isPrimary: boolean
}

export interface Resources {
  wood: number
  stone: number
  grain: number
}
