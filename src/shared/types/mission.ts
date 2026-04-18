import type { Resources } from './kingdom'

export type MissionType =
  | 'attack'
  | 'transport'
  | 'spy'
  | 'scavenge'
  | 'colonize'
  | 'pillage'
  | 'deploy'

export type MissionState = 'active' | 'returning' | 'completed'

export interface MissionResult {
  type: string
  outcome?: string
  rounds?: number
  loot?: Resources
  debris?: { wood: number; stone: number }
  lostAtk?: Record<string, number>
  lostDef?: Record<string, number>
  delivered?: boolean
  reason?: string
  message?: string
  success?: boolean
  name?: string
  target?: string
  collected?: { wood: number; stone: number }
}

export interface ArmyMission {
  id: number
  missionType: MissionType
  state: MissionState
  origin: { realm: number; region: number; slot: number }
  target: { realm: number; region: number; slot: number }
  arrivalTime: number
  returnTime: number | null
  eta: number
  units: Partial<Record<string, number>>
  resources: Resources
  result: MissionResult | null
}

export interface SendArmyParams {
  missionType: MissionType
  target: { realm: number; region: number; slot: number }
  units: Partial<Record<string, number>>
  resources?: Resources
}
