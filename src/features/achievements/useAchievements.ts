import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { achievementsService } from './services/achievementsService'
import type { Achievement, AchievementsResponse } from './types'
import { toast } from '@/lib/toast'
import { formatResource } from '@/lib/format'

export type { Achievement, AchievementsResponse }

// Module-level set to avoid duplicate toasts across component remounts
const notifiedIds = new Set<string>()

export function useAchievements() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: ['achievements'],
    queryFn: achievementsService.getAll,
    staleTime: 30_000,
  })

  const prevNewRef = useRef<string[]>([])

  useEffect(() => {
    const newOnes = query.data?.achievements.filter(a => a.isNew) ?? []
    for (const a of newOnes) {
      if (notifiedIds.has(a.id)) continue
      notifiedIds.add(a.id)
      const r = a.reward
      const rewardParts = r ? [
        r.wood  > 0 ? `${formatResource(r.wood)} madera`  : '',
        r.stone > 0 ? `${formatResource(r.stone)} piedra` : '',
        r.grain > 0 ? `${formatResource(r.grain)} grano`  : '',
      ].filter(Boolean) : []
      const rewardStr = rewardParts.length ? ` (+${rewardParts.join(', ')})` : ''
      toast.success(`🏆 Logro desbloqueado: ${a.name}${rewardStr}`)
    }
    prevNewRef.current = newOnes.map(a => a.id)
  }, [query.data])

  return { ...query, qc }
}

export function useNewAchievementsCount(): number {
  const { data } = useQuery({
    queryKey: ['achievements'],
    queryFn: achievementsService.getAll,
    staleTime: 30_000,
  })
  return data?.achievements.filter(a => a.isNew).length ?? 0
}
