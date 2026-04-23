import { http } from '@/shared/services/http'
import { supabase } from '@/lib/supabase'
import { snakeToCamelArray } from '@/lib/game/caseConvert'
import { UNITS, SUPPORT_UNITS, DEFENSES, MISSILES, unitBuildTime, unitRequirementsMet } from '@/lib/game/units'
import type { BarracksResponse, TrainUnitResponse, UnitInfo } from '../types'

interface UnitQueueRow {
  id: string
  unitType: string
  amount: number
  finishesAt: number
}

interface BuildingQueueRow {
  buildingType: string
  level: number
  finishesAt: number
}

interface UnitDef {
  id: string
  woodBase: number
  stoneBase: number
  grainBase: number
  hull: number
  shield: number
  attack: number
  requires: UnitInfo['requires']
}

export const barracksService = {
  async getAll(activeKingdomId?: string | null): Promise<BarracksResponse> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // Phase 1: kingdom + settings (parallel, don't need kingdom id yet)
    const [{ data: kingdomRows }, cfgRaw] = await Promise.all([
      supabase.rpc('my_kingdom', { kid: activeKingdomId ?? null }),
      http.get<{ economySpeed: number }>('/resources/settings').catch(() => ({ economySpeed: 1 })),
    ])
    const kingdomRow = Array.isArray(kingdomRows) ? kingdomRows[0] : null
    if (!kingdomRow) throw new Error('Reino no encontrado')

    const economySpeed = (cfgRaw as { economySpeed: number }).economySpeed ?? 1

    // Phase 2: buildings, units, research (all normalized tables), queues
    const [
      { data: buildingRows },
      { data: unitRows },
      { data: researchRows },
      { data: unitQueueRows },
      { data: buildingQueueRows },
    ] = await Promise.all([
      supabase.from('buildings').select('type, level').eq('kingdom_id', kingdomRow.id),
      supabase.from('units').select('type, quantity').eq('kingdom_id', kingdomRow.id),
      supabase.from('research').select('type, level').eq('user_id', user.id),
      supabase.from('unit_queue').select('id, unit_type, amount, finishes_at').eq('kingdom_id', kingdomRow.id),
      supabase.from('building_queue').select('building_type, level, finishes_at').eq('kingdom_id', kingdomRow.id),
    ])

    // Build projected state from normalized tables
    const projected: Record<string, number> = {}
    for (const r of buildingRows  ?? []) projected[r.type]  = r.level
    for (const r of unitRows      ?? []) projected[r.type]  = r.quantity

    const research: Record<string, number> = {}
    for (const r of researchRows ?? []) research[r.type] = r.level

    const queue: UnitQueueRow[] = snakeToCamelArray<UnitQueueRow>(unitQueueRows)
    const now = Math.floor(Date.now() / 1000)

    // Apply finished unit queue items so counts are up to date
    for (const item of queue) {
      if (item.finishesAt <= now) {
        projected[item.unitType] = (projected[item.unitType] ?? 0) + item.amount
      }
    }
    // Apply finished building queue items so requirement checks use correct levels
    for (const item of snakeToCamelArray<BuildingQueueRow>(buildingQueueRows)) {
      if (item.finishesAt <= now) {
        projected[item.buildingType] = Math.max(projected[item.buildingType] ?? 0, item.level)
      }
    }
    const activeQueue = queue.filter(q => q.finishesAt > now)

    const barracksLv = projected.barracks       ?? 0
    const egLv       = projected.engineersGuild ?? 0

    const mapUnit = (def: UnitDef): UnitInfo => {
      const queueItem = activeQueue.find(q => q.unitType === def.id)
      return {
        id:          def.id,
        count:       projected[def.id] ?? 0,
        woodBase:    def.woodBase,
        stoneBase:   def.stoneBase,
        grainBase:   def.grainBase,
        hull:        def.hull,
        shield:      def.shield,
        attack:      def.attack,
        timePerUnit: unitBuildTime(def.hull, barracksLv, egLv, 1, economySpeed),
        requiresMet: unitRequirementsMet(def, projected, research),
        requires:    def.requires,
        inQueue:     queueItem ? { amount: queueItem.amount, finishesAt: queueItem.finishesAt } : null,
      }
    }

    return {
      units:    (UNITS         as unknown as UnitDef[]).map(mapUnit),
      support:  (SUPPORT_UNITS as unknown as UnitDef[]).map(mapUnit),
      defenses: (DEFENSES      as unknown as UnitDef[]).map(mapUnit),
      missiles: (MISSILES      as unknown as UnitDef[]).map(mapUnit),
    }
  },

  train: (unit: string, amount: number, kingdomId?: string | null) =>
    http.post<TrainUnitResponse>('/barracks/train', { unit, amount, kingdomId }),
}
