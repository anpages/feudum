import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { lifeformsService } from './services/lifeformsService'
import { toast } from '@/lib/toast'
import type { CivilizationId } from './types'

const KEY = ['lifeforms']

export function useLifeforms() {
  return useQuery({
    queryKey: KEY,
    queryFn: lifeformsService.getAll,
  })
}

export function useSelectCivilization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (civ: CivilizationId) => lifeformsService.selectCivilization(civ),
    onSuccess: () => {
      toast.success('Civilización seleccionada')
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
    onError: (err: Error) => {
      const msg = (() => { try { return JSON.parse(err.message).error ?? err.message } catch { return err.message } })()
      toast.error(msg)
    },
  })
}

export function useBuildLFBuilding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (building: string) => lifeformsService.buildBuilding(building),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
    onError: (err: Error) => {
      const msg = (() => { try { return JSON.parse(err.message).error ?? err.message } catch { return err.message } })()
      toast.error(msg)
    },
  })
}

export function useResearchLF() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (research: string) => lifeformsService.researchTech(research),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
    onError: (err: Error) => {
      const msg = (() => { try { return JSON.parse(err.message).error ?? err.message } catch { return err.message } })()
      toast.error(msg)
    },
  })
}
