export interface UnitInfo {
  id: string
  count: number
  woodBase: number
  stoneBase: number
  grainBase: number
  hull: number
  shield: number
  attack: number
  timePerUnit: number
  requiresMet: boolean
  requires: { type: 'building' | 'research'; id: string; level: number }[]
  inQueue: { amount: number; finishesAt: number } | null
}

export interface BarracksResponse {
  units: UnitInfo[]
  support: UnitInfo[]
  defenses: UnitInfo[]
}

export interface TrainUnitResponse {
  ok: boolean
  finishesAt: number
  timeSeconds: number
}
