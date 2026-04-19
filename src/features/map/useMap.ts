import { useQuery } from '@tanstack/react-query'
import { mapService } from './services/mapService'
import type { MapSlot, MapResponse } from './types'

export type { MapSlot, MapResponse }

export function useMap(realm: number, region: number) {
  return useQuery({
    queryKey: ['map', realm, region],
    queryFn: () => mapService.getRegion(realm, region),
    staleTime: 60_000,
  })
}
