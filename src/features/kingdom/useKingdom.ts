import { useQuery, useQueryClient } from '@tanstack/react-query'
import { kingdomService } from './services/kingdomService'
import type { KingdomSummary } from '@/shared/types'
import type { Kingdom } from '@/../db/schema'

export type { KingdomSummary }
export type { Kingdom }

const STORAGE_KEY = 'feudum_active_kingdom'

export function getActiveKingdomId(): number | null {
  const v = localStorage.getItem(STORAGE_KEY)
  return v ? parseInt(v, 10) : null
}

export function setActiveKingdomId(id: number | null) {
  if (id === null) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, String(id))
}

export function useKingdom() {
  const activeId = getActiveKingdomId()
  return useQuery({
    queryKey: ['kingdom', activeId],
    queryFn: () => kingdomService.getMe(activeId),
    staleTime: 5_000,
    refetchInterval: 30_000,
  })
}

export function useKingdoms() {
  return useQuery({
    queryKey: ['kingdoms'],
    queryFn: kingdomService.getAll,
    staleTime: 30_000,
  })
}

export function useSwitchKingdom() {
  const qc = useQueryClient()
  return (id: number | null) => {
    setActiveKingdomId(id)
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }
}
