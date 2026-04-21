export interface BuildingInfo {
  id: string
  level: number
  nextLevel: number        // level that the next queue addition would target
  costWood: number         // cost to reach nextLevel
  costStone: number
  costGrain: number
  timeSeconds: number      // build time for nextLevel
  requiresMet: boolean
  requires: { type: 'building' | 'research'; id: string; level: number }[]
  inQueue: { level: number; startedAt: number; finishesAt: number } | null  // first (active) item
  queueDepth: number       // total items queued for this building
}

export interface BuildingsResponse {
  buildings: BuildingInfo[]
  totalQueueCount: number  // total items across all buildings (max 5)
}

export interface UpgradeBuildingResponse {
  ok: boolean
  finishesAt: number
  timeSeconds: number
  cost: { wood: number; stone: number }
}
