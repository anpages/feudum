import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { GiCauldron, GiCrossedSwords, GiCompass, GiScrollQuill } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { useResearch, useUpgradeResearch, useCancelResearch } from '@/features/research/useResearch'
import { applyOptimisticCompletions } from '@/features/queues/applyOptimisticCompletions'
import { useAccelerate } from '@/features/queues/useAccelerate'
import { useQueueSync } from '@/features/queues/useQueueSync'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { RESEARCH_META, CATEGORIES } from './researchMeta'
import { ResearchCard } from './components/ResearchCard'

const CATEGORY_META: Record<string, { Icon: React.ElementType; description: string }> = {
  Ciencia:      { Icon: GiCauldron,      description: 'Tecnologías arcanas que desbloquean unidades avanzadas, defensas y capacidades únicas.' },
  Combate:      { Icon: GiCrossedSwords, description: 'Mejora el ataque, la armadura y las defensas pasivas de todas tus tropas.' },
  Logística:    { Icon: GiCompass,       description: 'Velocidad de movimiento, capacidad de carga y rutas comerciales.' },
  Inteligencia: { Icon: GiScrollQuill,   description: 'Espionaje, exploración y aceleración de la investigación.' },
}

export function ResearchPage() {
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useResearch()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const upgrade = useUpgradeResearch()
  const cancel = useCancelResearch()
  const accelerate = useAccelerate()
  const syncQueues = useQueueSync()

  const handleCountdownEnd = useCallback(async () => {
    applyOptimisticCompletions(qc)
    await syncQueues()
    refetch()
    qc.invalidateQueries({ queryKey: ['buildings'] })
    qc.invalidateQueries({ queryKey: ['barracks'] })
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }, [refetch, syncQueues, qc])

  const items = useMemo(() => data?.research ?? [], [data])
  const queueCount = useMemo(() => items.filter(r => !!r.inQueue).length, [items])
  const hasInQueue = queueCount > 0
  const queueFull = queueCount >= 5
  const researchLevels = useMemo(() => Object.fromEntries(items.map(x => [x.id, x.level])), [items])

  if (isLoading) return <ResearchSkeleton />

  return (
    <div className="space-y-8">
      <div className="anim-fade-up">
        <span className="section-heading">Conocimiento</span>
        <h1 className="page-title mt-0.5">Academia</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Investiga tecnologías para desbloquear unidades, mejoras y ventajas estratégicas.
          {hasInQueue && (
            <span className="ml-2 text-gold font-ui text-xs font-semibold uppercase tracking-wide">
              · Investigación en curso
            </span>
          )}
        </p>
      </div>

      {CATEGORIES.map((cat, ci) => {
        const catItems = items.filter(r => RESEARCH_META[r.id]?.category === cat)
        if (!catItems.length) return null
        const { Icon, description } = CATEGORY_META[cat]
        return (
          <section key={cat} className={`anim-fade-up-${Math.min(ci + 1, 5) as 1|2|3|4|5}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-parchment-warm border border-gold/20 flex items-center justify-center shrink-0">
                <Icon size={17} className="text-gold-dim" />
              </div>
              <div>
                <span className="font-ui text-sm font-bold text-ink uppercase tracking-wider">{cat}</span>
                <p className="font-body text-xs text-ink-muted/70 mt-0.5 hidden sm:block">{description}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {catItems.map((r, i) => {
                const meta = RESEARCH_META[r.id]
                const canAfford =
                  resources.wood  >= r.costWood &&
                  resources.stone >= r.costStone &&
                  resources.grain >= r.costGrain
                return (
                  <ResearchCard
                    key={r.id}
                    item={r}
                    meta={meta}
                    kingdom={kingdom}
                    researchLevels={researchLevels}
                    canAfford={canAfford}
                    resources={resources}
                    globalQueueFull={queueFull && !r.inQueue}
                    isUpgrading={upgrade.isPending && upgrade.variables === r.id}
                    onUpgrade={() => upgrade.mutate(r.id)}
                    onCountdownEnd={handleCountdownEnd}
                    onAccelerate={r.inQueue ? () => accelerate.mutate('research') : undefined}
                    isAccelerating={accelerate.isPending}
                    onCancel={(queueId) => cancel.mutate(queueId)}
                    isCancelling={cancel.isPending}
                    animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1 | 2 | 3 | 4 | 5}`}
                  />
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ResearchSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-20" />
        <div className="skeleton h-8 w-36" />
        <div className="skeleton h-3 w-64" />
      </div>
      {[1, 2].map(i => (
        <div key={i}>
          <div className="flex gap-3 mb-4">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="space-y-1.5"><div className="skeleton h-3 w-24" /><div className="skeleton h-2.5 w-48" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, j) => (
              <Card key={j} className="p-5 space-y-4">
                <div className="space-y-2">
                  <div className="skeleton h-3 w-32" />
                  <div className="skeleton h-2.5 w-full" />
                </div>
                <div className="skeleton h-8 w-full rounded" />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
