import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface MapSlot {
  slot: number
  kingdomId: number | null
  name: string | null
  username: string | null
  isPlayer: boolean
  isNpc: boolean
  points: number
  isEmpty: boolean
  debris: { wood: number; stone: number } | null
}

export interface MapResponse {
  realm: number
  region: number
  maxRealm: number
  maxRegion: number
  myPosition: { realm: number; region: number; slot: number } | null
  slots: MapSlot[]
}

export function useMap(realm: number, region: number) {
  return useQuery({
    queryKey:  ['map', realm, region],
    queryFn:   () => api.get<MapResponse>(`/map?realm=${realm}&region=${region}`),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
