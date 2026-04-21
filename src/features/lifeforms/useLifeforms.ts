import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { lifeformsService } from './services/lifeformsService'
import { toast } from '@/lib/toast'
import type { CivilizationId, LifeformsResponse } from './types'

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
    onMutate: async (buildingId: string) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<LifeformsResponse>(KEY)
      if (prev) {
        const civ = prev.civilization
        if (civ) {
          const optimisticFinishesAt = Math.floor(Date.now() / 1000) + 60 // placeholder
          qc.setQueryData<LifeformsResponse>(KEY, old => {
            if (!old) return old
            return {
              ...old,
              buildings: {
                ...old.buildings,
                [civ]: old.buildings[civ].map(b =>
                  b.id === buildingId
                    ? { ...b, inQueue: { finishesAt: optimisticFinishesAt, level: b.nextLevel } }
                    : b
                ),
              },
            }
          })
        }
      }
      return { prev }
    },
    onSuccess: (data, _buildingId) => {
      qc.setQueryData<LifeformsResponse>(KEY, old => {
        if (!old || !old.civilization) return old
        const civ = old.civilization
        return {
          ...old,
          buildings: {
            ...old.buildings,
            [civ]: old.buildings[civ].map(b =>
              b.id === _buildingId
                ? { ...b, inQueue: { finishesAt: data.finishesAt, level: data.level } }
                : b
            ),
          },
        }
      })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
    onError: (err: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
      const msg = (() => { try { return JSON.parse(err.message).error ?? err.message } catch { return err.message } })()
      toast.error(msg)
    },
  })
}

export function useResearchLF() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (research: string) => lifeformsService.researchTech(research),
    onMutate: async (researchId: string) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<LifeformsResponse>(KEY)
      if (prev?.civilization) {
        const civ = prev.civilization
        const optimisticFinishesAt = Math.floor(Date.now() / 1000) + 60
        qc.setQueryData<LifeformsResponse>(KEY, old => {
          if (!old) return old
          return {
            ...old,
            research: {
              ...old.research,
              [civ]: old.research[civ].map(r =>
                r.id === researchId
                  ? { ...r, inQueue: { finishesAt: optimisticFinishesAt, level: r.nextLevel } }
                  : r
              ),
            },
          }
        })
      }
      return { prev }
    },
    onSuccess: (data, _researchId) => {
      qc.setQueryData<LifeformsResponse>(KEY, old => {
        if (!old?.civilization) return old
        const civ = old.civilization
        return {
          ...old,
          research: {
            ...old.research,
            [civ]: old.research[civ].map(r =>
              r.id === _researchId
                ? { ...r, inQueue: { finishesAt: data.finishesAt, level: data.level } }
                : r
            ),
          },
        }
      })
      qc.invalidateQueries({ queryKey: ['kingdom'] })
    },
    onError: (err: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
      const msg = (() => { try { return JSON.parse(err.message).error ?? err.message } catch { return err.message } })()
      toast.error(msg)
    },
  })
}
