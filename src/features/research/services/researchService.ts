import { http } from '@/shared/services/http'
import { supabase } from '@/lib/supabase'
import { snakeToCamel, snakeToCamelArray } from '@/lib/game/caseConvert'
import { RESEARCH, researchCost, researchTime, requirementsMet } from '@/lib/game/research'
import type { ResearchResponse, UpgradeResearchResponse } from '../types'

interface QueueRow {
  id: string
  research: string
  level: number
  finishesAt: number
}

export const researchService = {
  async getAll(activeKingdomId?: string | null): Promise<ResearchResponse> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    // academy level is a private column → must come from the my_kingdom() RPC.
    const [{ data: kingdomRows }, { data: researchRow }, { data: userRow }, { data: settingsRows }] = await Promise.all([
      supabase.rpc('my_kingdom', { kid: activeKingdomId ?? null }),
      supabase.from('research').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('users').select('character_class').eq('id', user.id).maybeSingle(),
      supabase.from('settings').select('key, value'),
    ])
    const kingdomRow = Array.isArray(kingdomRows) ? kingdomRows[0] : null
    if (!kingdomRow)  throw new Error('Reino no encontrado')
    if (!researchRow) throw new Error('Research no encontrado')

    const research = snakeToCamel<Record<string, number>>(researchRow)
    const characterClass = userRow?.character_class as string | null

    let researchSpeed = 1
    for (const r of settingsRows ?? []) {
      if (r.key === 'research_speed') researchSpeed = parseFloat(r.value as string)
    }

    const { data: queueRows } = await supabase
      .from('research_queue')
      .select('id, research, level, finishes_at')
      .eq('user_id', user.id)

    const queue: QueueRow[] = snakeToCamelArray<QueueRow>(queueRows)
    const now = Math.floor(Date.now() / 1000)

    const projected = { ...research }
    for (const item of queue) {
      if (item.finishesAt <= now) projected[item.research] = item.level
    }

    const activeQueue = queue.filter(q => q.finishesAt > now)
    const academyLevel = (kingdomRow.academy as number) ?? 0
    const kingdomForReqs = { academy: academyLevel } as Record<string, number>

    const result = RESEARCH.map(def => {
      const level = projected[def.id] ?? 0
      const cost  = researchCost(def, level)
      const baseTime = researchTime(cost.wood, cost.stone, academyLevel, researchSpeed)
      const timeSecs = characterClass === 'discoverer' ? Math.max(1, Math.floor(baseTime * 0.75)) : baseTime
      const queueItem = activeQueue.find(q => q.research === def.id)
      return {
        id:          def.id,
        level,
        costWood:    cost.wood,
        costStone:   cost.stone,
        costGrain:   cost.grain,
        timeSeconds: timeSecs,
        requiresMet: requirementsMet(def, kingdomForReqs, projected),
        requires:    def.requires as ResearchResponse['research'][number]['requires'],
        inQueue:     queueItem ? { level: queueItem.level, finishesAt: queueItem.finishesAt } : null,
      }
    })

    return { research: result }
  },

  upgrade: (researchId: string) =>
    http.post<UpgradeResearchResponse>('/research/upgrade', { research: researchId }),
}
