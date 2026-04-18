export interface BuildingInfo {
  id: string
  level: number
  costWood: number
  costStone: number
  costGrain: number
  timeSeconds: number
  requiresMet: boolean
  requires: { type: 'building' | 'research'; id: string; level: number }[]
  inQueue: { level: number; finishesAt: number } | null
}

export interface BuildingsResponse {
  buildings: BuildingInfo[]
}

export interface UpgradeBuildingResponse {
  ok: boolean
  finishesAt: number
  timeSeconds: number
  cost: { wood: number; stone: number }
}
