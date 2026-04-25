import { useCallback } from 'react'
import {
  GiArcher, GiCrossbow, GiBallista, GiTrebuchet,
  GiCrystalBall, GiLuciferCannon, GiPalisade, GiDefensiveWall, GiWrench, GiCatapult,
} from 'react-icons/gi'
import { type IconType } from 'react-icons'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { useBarracks, useTrainUnit } from '@/features/barracks/useBarracks'
import { applyOptimisticCompletions } from '@/features/queues/applyOptimisticCompletions'
import { useAccelerate } from '@/features/queues/useAccelerate'
import { useQueueSync } from '@/features/queues/useQueueSync'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResearch } from '@/features/research/useResearch'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { UnitCard } from '@/features/barracks/components/UnitCard'

const DEFENSE_META: Record<string, { name: string; Icon: IconType; description: string }> = {
  archer:       { Icon: GiArcher,       name: 'Arquero',           description: 'Defensa básica de bajo coste. Rapidez de disparo.' },
  crossbowman:  { Icon: GiCrossbow,     name: 'Ballestero',        description: 'Mayor alcance y penetración que el arquero.' },
  ballista:     { Icon: GiBallista,     name: 'Ballista',          description: 'Defensa pesada de largo alcance.' },
  trebuchet:    { Icon: GiTrebuchet,    name: 'Trebuchet',         description: 'Arma de asedio de largo alcance. Intercepta bombas alquímicas enemigas (1:1).' },
  mageTower:    { Icon: GiCrystalBall,  name: 'Torre Mágica',      description: 'Defensa energética con escudo poderoso.' },
  dragonCannon: { Icon: GiLuciferCannon, name: 'Cañón de Dragón',  description: 'La defensa más devastadora del reino.' },
  palisade:     { Icon: GiPalisade,     name: 'Empalizada',        description: 'Cúpula de escudo pequeña. Protege todas las demás defensas.' },
  castleWall:   { Icon: GiDefensiveWall, name: 'Muralla del Castillo', description: 'Cúpula de escudo grande. Una sola por reino.' },
  moat:         { Icon: GiWrench,       name: 'Foso',              description: 'Barrera defensiva que obstaculiza y ralentiza a los ejércitos atacantes.' },
  catapult:     { Icon: GiCatapult,     name: 'Catapulta',         description: 'Arma de asedio. Destruye defensas estáticas enemigas.' },
}

export function DefensePage() {
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useBarracks()
  const { data: kingdom } = useKingdom()
  const { data: researchData } = useResearch()
  const resources = useResourceTicker(kingdom)
  const train = useTrainUnit()
  const accelerate = useAccelerate()
  const syncQueues = useQueueSync()

  const handleCountdownEnd = useCallback(async () => {
    applyOptimisticCompletions(qc)
    await syncQueues()
    refetch()
    qc.invalidateQueries({ queryKey: ['armies'] })
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }, [refetch, syncQueues, qc])

  if (isLoading) return <DefenseSkeleton />

  const defenses = data?.defenses ?? []

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Ejército</span>
        <h1 className="page-title mt-0.5">Defensa</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Estructuras permanentes que protegen el reino. No viajan — siempre defienden.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {defenses.map((u, i) => {
          const meta = DEFENSE_META[u.id]
          if (!meta) return null
          return (
            <UnitCard
              key={u.id}
              unit={u}
              meta={meta}
              resources={resources}
              kingdom={kingdom}
              research={researchData?.research}
              isTraining={train.isPending && train.variables?.unit === u.id}
              onTrain={amount => train.mutate({ unit: u.id, amount })}
              onCountdownEnd={handleCountdownEnd}
              onAccelerate={u.inQueue ? () => accelerate.mutate('unit') : undefined}
              isAccelerating={accelerate.isPending}
              animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1|2|3|4|5}`}
            />
          )
        })}
      </div>
    </div>
  )
}

function DefenseSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-16" /><div className="skeleton h-8 w-28" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex gap-3"><div className="skeleton w-9 h-9 rounded-lg" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-28" /><div className="skeleton h-2.5 w-full" /></div></div>
            <div className="skeleton h-9 w-full rounded" />
          </Card>
        ))}
      </div>
    </div>
  )
}
