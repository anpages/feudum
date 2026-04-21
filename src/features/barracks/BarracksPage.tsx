import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, Lightbulb } from 'lucide-react'
import { type IconType } from 'react-icons'
import {
  GiLightFighter,
  GiHeavyFighter,
  GiMountedKnight,
  GiKnightBanner,
  GiCrossedSwords,
  GiSiegeTower,
  GiBattleMech,
  GiDragonHead,
  GiTrade,
  GiCaravan,
  GiCampingTent,
  GiVulture,
  GiSpyglass,
  GiBowArrow,
  GiCrossbow,
  GiBallista,
  GiCatapult,
  GiWizardStaff,
  GiDragonBreath,
  GiWoodBeam,
  GiBrickWall,
  GiMoai,
  GiWatchtower,
  GiMissileLauncher,
} from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { useBarracks, useTrainUnit } from '@/features/barracks/useBarracks'
import { useAccelerate } from '@/features/queues/useAccelerate'
import { useQueueSync } from '@/features/queues/useQueueSync'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResearch } from '@/features/research/useResearch'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { UnitCard } from '@/features/barracks/components/UnitCard'

// ── Static metadata ───────────────────────────────────────────────────────────

const UNIT_META: Record<string, { name: string; Icon: IconType; description: string }> = {
  squire:      { Icon: GiLightFighter,  name: 'Escudero',            description: 'Infantería ligera, rápida y económica.' },
  knight:      { Icon: GiHeavyFighter,  name: 'Caballero',           description: 'Combatiente pesado con armadura reforzada.' },
  paladin:     { Icon: GiMountedKnight, name: 'Paladín',             description: 'Caballería de élite, equilibrio entre velocidad y potencia.' },
  warlord:     { Icon: GiKnightBanner,  name: 'Señor de la Guerra',  description: 'Comandante de la batalla. Destrucción masiva.' },
  grandKnight: { Icon: GiCrossedSwords, name: 'Gran Caballero',      description: 'Interceptor de alta tecnología.' },
  siegeMaster: { Icon: GiSiegeTower,    name: 'Maestro de Asedio',   description: 'Especialista en destruir defensas.' },
  warMachine:  { Icon: GiBattleMech,    name: 'Máquina de Guerra',   description: 'El destructor más poderoso.' },
  dragonKnight:{ Icon: GiDragonHead,    name: 'Caballero Dragón',    description: 'La unidad definitiva. Capaz de destruir reinos.' },
  merchant:    { Icon: GiTrade,         name: 'Mercader',            description: 'Transporte ligero de recursos.' },
  caravan:     { Icon: GiCaravan,       name: 'Caravana',            description: 'Transporte pesado de alta capacidad.' },
  colonist:    { Icon: GiCampingTent,   name: 'Colonista',           description: 'Funda nuevos reinos en territorios vacíos.' },
  scavenger:   { Icon: GiVulture,       name: 'Carroñero',           description: 'Recoge los escombros de batallas.' },
  scout:       { Icon: GiSpyglass,      name: 'Explorador',          description: 'Espía reinos enemigos sin ser detectado.' },
  // Defenses
  archer:      { Icon: GiBowArrow,      name: 'Arquero',             description: 'Defensa ligera. Eficaz contra infantería.' },
  crossbowman: { Icon: GiCrossbow,      name: 'Ballestero',          description: 'Defensa reforzada con alcance mayor.' },
  ballista:    { Icon: GiBallista,      name: 'Ballista',            description: 'Artillería pesada. Destruye unidades acorazadas.' },
  trebuchet:   { Icon: GiCatapult,      name: 'Trebuchet',           description: 'Arma de asedio de largo alcance. Intercepta bombas alquímicas enemigas (1:1).' },
  mageTower:   { Icon: GiWizardStaff,   name: 'Torre Maga',          description: 'Defensa arcana con escudo masivo.' },
  dragonCannon:{ Icon: GiDragonBreath,  name: 'Cañón Dragón',        description: 'Turreta de plasma dracónico. Devastadora.' },
  palisade:    { Icon: GiWoodBeam,      name: 'Palizada',            description: 'Escudo pequeño. Protege toda la defensa.' },
  castleWall:  { Icon: GiBrickWall,     name: 'Muralla',             description: 'Escudo máximo. Protección total del reino.' },
  moat:        { Icon: GiMoai,          name: 'Foso',                description: 'Barrera defensiva. Ralentiza a los atacantes.' },
  catapult:    { Icon: GiCatapult,      name: 'Catapulta',           description: 'Arma de asedio. Destruye posiciones enemigas.' },
  beacon:      { Icon: GiWatchtower,    name: 'Faro',                description: 'Torre de vigilancia. Detecta ejércitos enemigos.' },
  // Missiles
  ballistic:   { Icon: GiMissileLauncher, name: 'Bomba Alquímica',   description: 'Arma de un solo uso. Daña defensas enemigas a distancia. Los trebuchets la interceptan.' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

const BARRACKS_GUIDE_KEY = 'barracks_guide_seen'

interface BarracksPageProps {
  mode: 'attack' | 'support'
}

export function BarracksPage({ mode }: BarracksPageProps) {
  const qc = useQueryClient()
  const [guideVisible, setGuideVisible] = useState(() => !localStorage.getItem(BARRACKS_GUIDE_KEY))
  const { data, isLoading, refetch } = useBarracks()
  const { data: kingdom } = useKingdom()
  const { data: researchData } = useResearch()
  const resources = useResourceTicker(kingdom)
  const train = useTrainUnit()
  const accelerate = useAccelerate()
  const syncQueues = useQueueSync()

  const handleCountdownEnd = useCallback(async () => {
    await syncQueues()
    refetch()
    qc.invalidateQueries({ queryKey: ['armies'] })
  }, [refetch, syncQueues, qc])

  function dismissGuide() {
    localStorage.setItem(BARRACKS_GUIDE_KEY, '1')
    setGuideVisible(false)
  }

  if (isLoading) return <BarracksSkeleton />

  const isAttack = mode === 'attack'
  const items = isAttack
    ? [...(data?.units ?? []), ...(data?.missiles ?? [])]
    : (data?.support ?? [])

  const pageTitle = isAttack ? 'Tropas de Ataque' : 'Unidades de Apoyo'
  const pageDesc  = isAttack
    ? 'Entrena unidades de combate para atacar reinos enemigos y defender el tuyo.'
    : 'Entrena unidades de apoyo para explorar, transportar recursos y colonizar territorios.'

  return (
    <div className="space-y-8">
      <div className="anim-fade-up">
        <span className="section-heading">Ejército</span>
        <h1 className="page-title mt-0.5">{pageTitle}</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">{pageDesc}</p>
      </div>

      {/* Beginner guide — only on attack page */}
      {isAttack && guideVisible && (
        <div className="anim-fade-up-1 flex items-start gap-3 px-4 py-3.5 rounded-lg border border-gold/20 bg-gold-soft">
          <Lightbulb size={15} className="text-gold shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-ui text-xs font-semibold text-ink">¿Por dónde empezar?</p>
            <p className="font-body text-xs text-ink-muted leading-relaxed">
              Entrena <strong className="text-ink">Escuderos</strong> como tropa básica de ataque.
              Visita <strong className="text-ink">Apoyo</strong> para entrenar Exploradores y espiar reinos vecinos.
            </p>
          </div>
          <button onClick={dismissGuide} className="shrink-0 p-1 rounded text-ink-muted hover:text-ink transition-colors">
            <X size={13} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((u, i) => {
          const meta = UNIT_META[u.id]
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
              animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1 | 2 | 3 | 4 | 5}`}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BarracksSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-16" />
        <div className="skeleton h-8 w-32" />
      </div>
      <div className="skeleton h-9 w-40 rounded-md" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-5 space-y-4">
            <div className="flex gap-3">
              <div className="skeleton w-8 h-8 rounded" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-28" />
                <div className="skeleton h-2.5 w-full" />
              </div>
            </div>
            <div className="skeleton h-10 w-full rounded" />
            <div className="skeleton h-9 w-full rounded" />
          </Card>
        ))}
      </div>
    </div>
  )
}
