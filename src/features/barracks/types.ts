export interface UnitInfo {
  id: string
  count: number          // unidades disponibles en almacén (sin contar misiones)
  inMission: number      // unidades en misiones activas (no en almacén)
  total: number          // count + inMission — flota real total
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
  missiles: UnitInfo[]
}

export interface TrainUnitResponse {
  ok: boolean
  finishesAt: number
  timeSeconds: number
}
