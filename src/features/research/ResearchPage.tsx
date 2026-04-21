import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { GiCauldron, GiCrossedSwords, GiCompass, GiScrollQuill } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { useResearch, useUpgradeResearch } from '@/features/research/useResearch'
import { useAccelerate } from '@/features/queues/useAccelerate'
import { useQueueSync } from '@/features/queues/useQueueSync'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { RESEARCH_META, CATEGORIES } from './researchMeta'
import { ResearchCard } from './components/ResearchCard'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Ciencia:      <GiCauldron      size={14} />,
  Combate:      <GiCrossedSwords size={14} />,
  Logística:    <GiCompass       size={14} />,
  Inteligencia: <GiScrollQuill   size={14} />,
}

export function ResearchPage() {
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useResearch()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const upgrade = useUpgradeResearch()
  const accelerate = useAccelerate()
  const syncQueues = useQueueSync()

  const handleCountdownEnd = useCallback(async () => {
    await syncQueues()
    refetch()
    qc.invalidateQueries({ queryKey: ['buildings'] })
    qc.invalidateQueries({ queryKey: ['barracks'] })
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

      {CATEGORIES.map(cat => {
        const catItems = items.filter(r => RESEARCH_META[r.id]?.category === cat)
        if (!catItems.length) return null
        return (
          <section key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-gold">{CATEGORY_ICONS[cat]}</span>
              <span className="section-heading mb-0">{cat}</span>
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
          <div className="skeleton h-2.5 w-24 mb-4" />
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
