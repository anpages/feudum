export type CivilizationId = 'romans' | 'vikings' | 'byzantines' | 'saracens'

export interface Civilization {
  id: CivilizationId
  name: string
  description: string
}

export interface LFQueueEntry {
  finishesAt: number
  level: number
}

export interface LFBuildingInfo {
  id: string
  name: string
  description: string
  role: string
  level: number
  nextLevel: number
  cost: { wood: number; stone: number; grain: number }
  timeSecs: number
  requiresMet: boolean
  requires: { id: string; level: number }[]
  bonuses: { type: string; base: number; factor: number }[]
  inQueue: LFQueueEntry | null
}

export interface LFResearchInfo {
  id: string
  name: string
  tier: 1 | 2 | 3
  level: number
  nextLevel: number
  cost: { wood: number; stone: number; grain: number }
  timeSecs: number
  effects: { type: string; base: number }[]
  inQueue: LFQueueEntry | null
}

export interface LifeformsResponse {
  civilization: CivilizationId | null
  civLevels: Record<CivilizationId, number>
  population: { t1: number; t2: number; t3: number }
  foodStored: number
  artifacts: number
  tiers: { t1: boolean; t2: boolean; t3: boolean }
  civilizations: Civilization[]
  buildings: Record<CivilizationId, LFBuildingInfo[]>
  research: Record<CivilizationId, LFResearchInfo[]>
}
