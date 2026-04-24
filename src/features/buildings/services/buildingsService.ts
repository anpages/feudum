import { http } from '@/shared/services/http'
import { supabase } from '@/lib/supabase'
import { snakeToCamel, snakeToCamelArray } from '@/lib/game/caseConvert'
import {
  BUILDINGS, buildCost, buildTime, applyBuildingEffect, buildingRequirementsMet,
  calcFieldMax, calcFieldsUsed,
} from '@/lib/game/buildings'
import type { BuildingsResponse, UpgradeBuildingResponse } from '../types'

interface QueueRow {
  id: string
  buildingType: string
  level: number
  startedAt: number
  finishesAt: number
}

export const buildingsService = {
  async getAll(activeKingdomId?: string | null): Promise<BuildingsResponse> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // Phase 1: kingdom + settings
    const [{ data: kingdomRows }, cfgRaw] = await Promise.all([
      supabase.rpc('my_kingdom', { kid: activeKingdomId ?? null }),
      http.get<{ economySpeed: number }>('/resources/settings').catch(() => ({ economySpeed: 1 })),
    ])
    const kingdomRow = Array.isArray(kingdomRows) ? kingdomRows[0] : null
    if (!kingdomRow) throw new Error('Reino no encontrado')

    const economySpeed = (cfgRaw as { economySpeed: number }).economySpeed ?? 1

    // Phase 2: buildings levels + queue + research (all need user/kingdom id)
    const [{ data: buildingRows }, { data: queueRows }, { data: researchRows }] = await Promise.all([
      supabase.from('buildings').select('type, level').eq('kingdom_id', kingdomRow.id),
      supabase.from('building_queue')
        .select('id, building_type, level, started_at, finishes_at')
        .eq('kingdom_id', kingdomRow.id),
      supabase.from('research').select('type, level').eq('user_id', user.id),
    ])

    // Base kingdom resources + coords
    const kingdom = snakeToCamel<Record<string, number>>(kingdomRow)

    // Merge building levels from the buildings table
    const projected: Record<string, number> = { ...kingdom }
    for (const r of buildingRows ?? []) projected[r.type] = r.level

    const researchMap: Record<string, number> = {}
    for (const r of researchRows ?? []) researchMap[r.type] = r.level

    const queue: QueueRow[] = snakeToCamelArray<QueueRow>(queueRows)
    const now = Math.floor(Date.now() / 1000)

    // Apply finished queue items so counts are up to date
    for (const item of queue) {
      if (item.finishesAt <= now) {
        Object.assign(projected, applyBuildingEffect(item.buildingType, item.level, projected))
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
      const queueItem = activeQueue.find(q => q.buildingType === def.id) ?? null

      return {
        id:          def.id,
        level,
        nextLevel,
        costWood:    cost.wood,
        costStone:   cost.stone,
        costGrain:   cost.grain,
        timeSeconds: timeSecs,
        requiresMet: buildingRequirementsMet(def, projected, researchMap),
        requires:    def.requires as BuildingsResponse['buildings'][number]['requires'],
        inQueue:     queueItem ? { id: queueItem.id, level: queueItem.level, startedAt: queueItem.startedAt, finishesAt: queueItem.finishesAt } : null,
        queueDepth:  activeQueue.filter(q => q.buildingType === def.id).length,
      }
    })

    const fieldsUsed = calcFieldsUsed(projected)
    const fieldMax   = calcFieldMax(projected.alchemistTower ?? 0)

    return { buildings, totalQueueCount, fields: { used: fieldsUsed, max: fieldMax } }
  },

  upgrade: (buildingId: string, kingdomId?: string | null) =>
    http.post<UpgradeBuildingResponse>('/buildings/upgrade', { building: buildingId, kingdomId }),

  cancel: (queueId: string) =>
    http.post<{ ok: boolean; refund: { wood: number; stone: number; grain: number } }>('/buildings/cancel', { queueId }),
}
