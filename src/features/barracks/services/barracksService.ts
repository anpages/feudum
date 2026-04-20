import { http } from '@/shared/services/http'
import { supabase } from '@/lib/supabase'
import { snakeToCamel, snakeToCamelArray } from '@/lib/game/caseConvert'
import { UNITS, SUPPORT_UNITS, DEFENSES, MISSILES, unitBuildTime, unitRequirementsMet } from '@/lib/game/units'
import type { BarracksResponse, TrainUnitResponse, UnitInfo } from '../types'

interface QueueRow {
  id: string
  unit: string
  amount: number
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

    const [{ data: kingdomRows }, { data: researchRow }, { data: settingsRows }] = await Promise.all([
      supabase.rpc('my_kingdom', { kid: activeKingdomId ?? null }),
      supabase.from('research').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('settings').select('key, value'),
    ])
    const kingdomRow = Array.isArray(kingdomRows) ? kingdomRows[0] : null
    if (!kingdomRow)  throw new Error('Reino no encontrado')
    if (!researchRow) throw new Error('Research no encontrado')

    const kingdom  = snakeToCamel<Record<string, number>>(kingdomRow)
    const research = snakeToCamel<Record<string, number>>(researchRow)

    let economySpeed = 1
    for (const r of settingsRows ?? []) {
      if (r.key === 'economy_speed') economySpeed = parseFloat(r.value as string)
    }

    const [{ data: queueRows }, { data: buildingQueueRows }] = await Promise.all([
      supabase.from('unit_queue').select('id, unit, amount, finishes_at').eq('kingdom_id', kingdomRow.id),
      supabase.from('building_queue').select('building, level, finishes_at').eq('kingdom_id', kingdomRow.id),
    ])

    const queue: QueueRow[] = snakeToCamelArray<QueueRow>(queueRows)
    const now = Math.floor(Date.now() / 1000)

    // Apply finished unit queue items so counts are up to date
    const projected = { ...kingdom }
    for (const item of queue) {
      if (item.finishesAt <= now) {
        projected[item.unit] = (projected[item.unit] ?? 0) + item.amount
      }
    }
    // Apply finished building queue items so requirement checks use the correct levels
    for (const item of snakeToCamelArray<{ building: string; level: number; finishesAt: number }>(buildingQueueRows)) {
      if (item.finishesAt <= now) {
        projected[item.building] = Math.max(projected[item.building] ?? 0, item.level)
      }
    }
    const activeQueue = queue.filter(q => q.finishesAt > now)

    const barracksLv = projected.barracks       ?? 0
    const egLv       = projected.engineersGuild ?? 0

    const mapUnit = (def: UnitDef): UnitInfo => {
      const queueItem = activeQueue.find(q => q.unit === def.id)
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

  train: (unit: string, amount: number) =>
    http.post<TrainUnitResponse>('/barracks/train', { unit, amount }),
}
