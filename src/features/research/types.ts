export interface ResearchInfo {
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

export interface ResearchResponse {
  research: ResearchInfo[]
}

export interface UpgradeResearchResponse {
  ok: boolean
  finishesAt: number
  timeSeconds: number
}
