import type { QueryClient } from '@tanstack/react-query'
import { BUILDINGS, buildCost, buildTime } from '@/lib/game/buildings'
import { RESEARCH, researchCost, researchTime } from '@/lib/game/research'
import type { BuildingsResponse } from '@/features/buildings/types'
import type { ResearchResponse } from '@/features/research/types'
import type { BarracksResponse, UnitInfo } from '@/features/barracks/types'

/**
 * Applies all queue completions optimistically across buildings, research and
 * barracks caches simultaneously. Recalculates costs, build time and
 * requiresMet for every item so the UI is consistent the instant a countdown
 * reaches zero — before the server round-trip completes.
 */
export function applyOptimisticCompletions(qc: QueryClient): void {
  const now = Math.floor(Date.now() / 1000)

  // ── Step 1: compute post-completion levels from all active caches ──────────
  // We account for items finishing RIGHT NOW so requiresMet is correct for
  // items that were blocked by the just-completed build/research.

  const buildingLevels: Record<string, number> = {}
  const researchLevels: Record<string, number> = {}

  for (const [, data] of qc.getQueriesData<BuildingsResponse>({ queryKey: ['buildings'] })) {
    if (!data) continue
    for (const b of data.buildings) {
      const lv = b.inQueue && b.inQueue.finishesAt <= now ? b.inQueue.level : b.level
      if ((buildingLevels[b.id] ?? 0) < lv) buildingLevels[b.id] = lv
    }
  }

  for (const [, data] of qc.getQueriesData<ResearchResponse>({ queryKey: ['research'] })) {
    if (!data) continue
    for (const r of data.research) {
      const lv = r.inQueue && r.inQueue.finishesAt <= now ? r.inQueue.level : r.level
      if ((researchLevels[r.id] ?? 0) < lv) researchLevels[r.id] = lv
    }
  }

  const workshopLv   = buildingLevels['workshop']       ?? 0
  const engineersLv  = buildingLevels['engineersGuild'] ?? 0
  const academyLv    = buildingLevels['academy']        ?? 0

  const meetsReqs = (requires: { type: string; id: string; level: number }[]): boolean =>
    (requires ?? []).every(req => {
      const lv = req.type === 'building'
        ? (buildingLevels[req.id] ?? 0)
        : (researchLevels[req.id] ?? 0)
      return lv >= req.level
    })

  // ── Step 2: update buildings cache ────────────────────────────────────────

  qc.setQueriesData<BuildingsResponse>({ queryKey: ['buildings'] }, prev => {
    if (!prev) return prev
    let completed = 0
    const buildings = prev.buildings.map(b => {
      const completing = !!b.inQueue && b.inQueue.finishesAt <= now
      const newRequiresMet = meetsReqs(b.requires ?? [])

      if (!completing) {
        return newRequiresMet !== b.requiresMet ? { ...b, requiresMet: newRequiresMet } : b
      }

      completed++
      const newLevel     = b.inQueue!.level
      const newNextLevel = newLevel + 1
      const def = BUILDINGS.find(d => d.id === b.id)
      if (!def) return { ...b, level: newLevel, nextLevel: newNextLevel, inQueue: null, requiresMet: newRequiresMet }

      const costs   = buildCost(def.woodBase, def.stoneBase, def.factor, newLevel, def.grainBase)
      const newTime = buildTime(costs.wood, costs.stone, newNextLevel, workshopLv, engineersLv)

      return {
        ...b,
        level:       newLevel,
        nextLevel:   newNextLevel,
        costWood:    costs.wood,
        costStone:   costs.stone,
        costGrain:   costs.grain,
        timeSeconds: newTime,
        inQueue:     null,
        requiresMet: newRequiresMet,
      }
    })
    return { ...prev, buildings, totalQueueCount: Math.max(0, prev.totalQueueCount - completed) }
  })

  // ── Step 3: update research cache ─────────────────────────────────────────

  qc.setQueriesData<ResearchResponse>({ queryKey: ['research'] }, prev => {
    if (!prev) return prev
    return {
      research: prev.research.map(r => {
        const completing    = !!r.inQueue && r.inQueue.finishesAt <= now
        const newRequiresMet = meetsReqs(r.requires ?? [])

        if (!completing) {
          return newRequiresMet !== r.requiresMet ? { ...r, requiresMet: newRequiresMet } : r
        }

        const newLevel = r.inQueue!.level
        const def = RESEARCH.find(d => d.id === r.id)
        if (!def) return { ...r, level: newLevel, inQueue: null, requiresMet: newRequiresMet }

        const costs   = researchCost(def, newLevel)
        const newTime = researchTime(costs.wood, costs.stone, academyLv)

        return {
          ...r,
          level:       newLevel,
          costWood:    costs.wood,
          costStone:   costs.stone,
          costGrain:   costs.grain,
          timeSeconds: newTime,
          inQueue:     null,
          requiresMet: newRequiresMet,
        }
      }),
    }
  })

  // ── Step 4: update barracks cache ─────────────────────────────────────────

  qc.setQueriesData<BarracksResponse>({ queryKey: ['barracks'] }, prev => {
    if (!prev) return prev
    const update = (list: UnitInfo[]) =>
      list.map(u => {
        const completing    = !!u.inQueue && u.inQueue.finishesAt <= now
        const newRequiresMet = meetsReqs(u.requires ?? [])

        if (!completing) {
          return newRequiresMet !== u.requiresMet ? { ...u, requiresMet: newRequiresMet } : u
        }

        return { ...u, count: u.count + u.inQueue!.amount, inQueue: null, requiresMet: newRequiresMet }
      })

    return {
      units:    update(prev.units),
      support:  update(prev.support),
      defenses: update(prev.defenses),
      missiles: update(prev.missiles ?? []),
    }
  })
}
