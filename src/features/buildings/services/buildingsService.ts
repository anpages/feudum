import { http } from '@/shared/services/http'
import { supabase } from '@/lib/supabase'
import { snakeToCamel, snakeToCamelArray } from '@/lib/game/caseConvert'
import {
  BUILDINGS, buildCost, buildTime, applyBuildingEffect, buildingRequirementsMet,
} from '@/lib/game/buildings'
import type { BuildingsResponse, UpgradeBuildingResponse } from '../types'

interface QueueRow {
  id: string
  building: string
  level: number
  finishesAt: number
}

export const buildingsService = {
  async getAll(activeKingdomId?: string | null): Promise<BuildingsResponse> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    const [{ data: kingdomRows }, { data: researchRow }, { data: settingsRows }] = await Promise.all([
      supabase.rpc('my_kingdom', { kid: activeKingdomId ?? null }),
      supabase.from('research').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('settings').select('key, value'),
    ])
    const kingdomRow = Array.isArray(kingdomRows) ? kingdomRows[0] : null
    if (!kingdomRow) throw new Error('Reino no encontrado')

    const kingdom = snakeToCamel<Record<string, number>>(kingdomRow)
    const research = researchRow ? snakeToCamel<Record<string, number>>(researchRow) : {}

    let economySpeed = 1
    for (const r of settingsRows ?? []) {
      if (r.key === 'economy_speed') economySpeed = parseFloat(r.value as string)
    }

    const { data: queueRows } = await supabase
      .from('building_queue')
      .select('id, building, level, finishes_at')
      .eq('kingdom_id', kingdomRow.id)

    const queue: QueueRow[] = snakeToCamelArray<QueueRow>(queueRows)
    const now = Math.floor(Date.now() / 1000)

    // Apply finished items locally so the UI shows correct levels without waiting for server.
    const projected = { ...kingdom }
    for (const item of queue) {
      if (item.finishesAt <= now) {
        Object.assign(projected, applyBuildingEffect(item.building, item.level, projected))
      }
    }

    const activeQueue = queue.filter(q => q.finishesAt > now)
    const totalQueueCount = activeQueue.length

    const workshopLevel       = projected.workshop       ?? 0
    const engineersGuildLevel = projected.engineersGuild ?? 0

    const buildings = BUILDINGS.map(def => {
      const level     = projected[def.id] ?? 0
      const nextLevel = level + 1
      const cost      = buildCost(def.woodBase, def.stoneBase, def.factor, level, def.grainBase)
      const timeSecs  = buildTime(cost.wood, cost.stone, nextLevel, workshopLevel, engineersGuildLevel, economySpeed)
      const queueItem = activeQueue.find(q => q.building === def.id) ?? null

      return {
        id:          def.id,
        level,
        nextLevel,
        costWood:    cost.wood,
        costStone:   cost.stone,
        costGrain:   cost.grain,
        timeSeconds: timeSecs,
        requiresMet: buildingRequirementsMet(def, projected, research),
        requires:    def.requires as BuildingsResponse['buildings'][number]['requires'],
        inQueue:     queueItem ? { level: queueItem.level, finishesAt: queueItem.finishesAt } : null,
        queueDepth:  queueItem ? 1 : 0,
      }
    })

    return { buildings, totalQueueCount }
  },

  upgrade: (buildingId: string) =>
    http.post<UpgradeBuildingResponse>('/buildings/upgrade', { building: buildingId }),
}
