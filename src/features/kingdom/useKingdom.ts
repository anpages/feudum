import { useQuery, useQueryClient } from '@tanstack/react-query'
import { kingdomService } from './services/kingdomService'
import type { KingdomSummary } from '@/shared/types'
import type { Kingdom } from '@/../db/schema'

export type { KingdomSummary }
export type { Kingdom }

const STORAGE_KEY = 'feudum_active_kingdom'

export function getActiveKingdomId(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export function setActiveKingdomId(id: string | null) {
  if (id === null) localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, id)
}

export function useKingdom() {
  const activeId = getActiveKingdomId()
  return useQuery({
    queryKey: ['kingdom', activeId],
    queryFn: () => kingdomService.getMe(activeId),
  })
}

export function useKingdoms() {
  return useQuery({
    queryKey: ['kingdoms'],
    queryFn: kingdomService.getAll,
    staleTime: 60_000,
  })
}

export function useSwitchKingdom() {
  const qc = useQueryClient()
  return (id: string | null) => {
    setActiveKingdomId(id)
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }
}
