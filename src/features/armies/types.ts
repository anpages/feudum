import type { ArmyMission, IncomingMission, SendArmyParams } from '@/shared/types'

export type { ArmyMission, IncomingMission, SendArmyParams }

export interface ArmiesResponse {
  missions: ArmyMission[]
  incomingMissions: IncomingMission[]
  underAttack: boolean
  fleetSlots: { used: number; max: number }
  top1Points: number
  characterClass: string | null
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
