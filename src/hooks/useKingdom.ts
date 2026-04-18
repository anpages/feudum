import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Kingdom } from '../../db/schema'

export interface KingdomSummary {
  id:     number
  name:   string
  realm:  number
  region: number
  slot:   number
}

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
  const url = activeId ? `/kingdoms/me?id=${activeId}` : '/kingdoms/me'
  return useQuery({
    queryKey:        ['kingdom', activeId],
    queryFn:         () => api.get<Kingdom>(url),
    staleTime:       5_000,
    refetchInterval: 10_000,
  })
}

export function useKingdoms() {
  return useQuery({
    queryKey: ['kingdoms'],
    queryFn:  () => api.get<{ kingdoms: KingdomSummary[] }>('/kingdoms'),
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
