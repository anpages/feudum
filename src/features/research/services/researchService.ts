import { http } from '@/shared/services/http'
import { supabase } from '@/lib/supabase'
import { snakeToCamelArray } from '@/lib/game/caseConvert'
import { RESEARCH, researchCost, researchTime, requirementsMet } from '@/lib/game/research'
import type { ResearchResponse, UpgradeResearchResponse } from '../types'

interface ResearchQueueRow {
  id: string
  researchType: string
  level: number
  startedAt: number
  finishesAt: number
}

interface BuildingQueueRow {
  buildingType: string
  level: number
  finishesAt: number
}

export const researchService = {
  async getAll(activeKingdomId?: string | null): Promise<ResearchResponse> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // Phase 1: kingdom + user character class + settings (parallel)
    const [{ data: kingdomRows }, { data: userRow }, cfgRaw] = await Promise.all([
      supabase.rpc('my_kingdom', { kid: activeKingdomId ?? null }),
      supabase.from('users').select('character_class').eq('id', user.id).maybeSingle(),
      http.get<{ researchSpeed: number }>('/resources/settings').catch(() => ({ researchSpeed: 1 })),
    ])
    const kingdomRow = Array.isArray(kingdomRows) ? kingdomRows[0] : null
    if (!kingdomRow) throw new Error('Reino no encontrado')

    const characterClass = userRow?.character_class as string | null
    const researchSpeed = (cfgRaw as { researchSpeed: number }).researchSpeed ?? 1

    // Phase 2: normalized tables + queues (need kingdom id from phase 1)
    const [
      { data: buildingRows },
      { data: researchRows },
      { data: queueRows },
      { data: buildingQueueRows },
    ] = await Promise.all([
      supabase.from('buildings').select('type, level').eq('kingdom_id', kingdomRow.id),
      supabase.from('research').select('type, level').eq('user_id', user.id),
      supabase.from('research_queue').select('id, research_type, level, started_at, finishes_at').eq('user_id', user.id),
      supabase.from('building_queue').select('building_type, level, finishes_at').eq('kingdom_id', kingdomRow.id),
    ])

    // Build research map from normalized rows
    const research: Record<string, number> = {}
    for (const r of researchRows ?? []) research[r.type] = r.level

    const queue: ResearchQueueRow[] = snakeToCamelArray<ResearchQueueRow>(queueRows)
    const now = Math.floor(Date.now() / 1000)

    const projected = { ...research }
    for (const item of queue) {
      if (item.finishesAt <= now) projected[item.researchType] = item.level
    }

    const activeQueue = queue.filter(q => q.finishesAt > now)

    // Build academy level: start from buildings table, then apply finished building queue
    const buildingMap: Record<string, number> = {}
    for (const r of buildingRows ?? []) buildingMap[r.type] = r.level

    let academyLevel = buildingMap.academy ?? 0
    for (const item of snakeToCamelArray<BuildingQueueRow>(buildingQueueRows)) {
      if (item.finishesAt <= now && item.buildingType === 'academy') {
        academyLevel = Math.max(academyLevel, item.level)
      }
    }
    const kingdomForReqs = { ...buildingMap } as Record<string, number>

    const result = RESEARCH.map(def => {
      const level = projected[def.id] ?? 0
      const cost  = researchCost(def, level)
      const baseTime = researchTime(cost.wood, cost.stone, academyLevel, researchSpeed)
      const timeSecs = characterClass === 'discoverer' ? Math.max(1, Math.floor(baseTime * 0.75)) : baseTime
      const queueItem = activeQueue.find(q => q.researchType === def.id)
      return {
        id:          def.id,
        level,
        costWood:    cost.wood,
        costStone:   cost.stone,
        costGrain:   cost.grain,
        timeSeconds: timeSecs,
        requiresMet: requirementsMet(def, kingdomForReqs, projected),
        requires:    def.requires as ResearchResponse['research'][number]['requires'],
        inQueue:     queueItem ? { id: queueItem.id, level: queueItem.level, startedAt: queueItem.startedAt, finishesAt: queueItem.finishesAt } : null,
      }
    })

    return { research: result }
  },

  upgrade: (researchId: string, kingdomId?: string | null) =>
    http.post<UpgradeResearchResponse>('/research/upgrade', { research: researchId, kingdomId }),

  cancel: (queueId: string) =>
    http.post<{ ok: boolean; refund: { wood: number; stone: number; grain: number } }>('/research/cancel', { queueId }),
}
