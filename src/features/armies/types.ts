import type { ArmyMission, SendArmyParams } from '@/shared/types'

export type { ArmyMission, SendArmyParams }

export interface ArmiesResponse {
  missions: ArmyMission[]
  fleetSlots: { used: number; max: number }
}

export interface SendArmyResponse {
  ok: boolean
  missionId: string
  arrivalTime: number
  returnTime: number
  travelSeconds: number
}

export interface RecallArmyResponse {
  ok: boolean
  returnTime: number
}
