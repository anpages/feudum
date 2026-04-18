import { useState, useCallback, useEffect } from 'react'
import { ChevronDown, Sparkles, X } from 'lucide-react'
import { type IconType } from 'react-icons'
import {
  GiLogging,
  GiMining,
  GiGranary,
  GiWindmill,
  GiAnvil,
  GiGearHammer,
  GiMedievalBarracks,
  GiSpellBook,
  GiWoodBeam,
  GiBrickWall,
  GiGrain,
  GiChurch,
  GiMagicGate,
  GiScrollUnfurled,
  GiShieldReflect,
  GiFactory,
  GiOpenTreasureChest,
  GiVillage,
} from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { useBuildings, useUpgradeBuilding } from '@/features/buildings/useBuildings'
import { useAccelerate } from '@/features/queues/useAccelerate'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { useQueryClient } from '@tanstack/react-query'
import { BuildingCard, type BuildingMeta } from './components/BuildingCard'
import type { BuildingInfo } from './types'
import { toast } from '@/lib/toast'

// ── Static metadata ───────────────────────────────────────────────────────────

const BUILDING_META: Record<string, BuildingMeta> = {
  sawmill: {
    name: 'Aserradero',
    Icon: GiLogging,
    produces: 'Madera',
    category: 'production',
    effect: '+30 × nivel × 1.1^nivel madera/h',
    description: 'Tala los bosques del reino para producir madera sin cesar.',
  },
  quarry: {
    name: 'Cantera',
    Icon: GiMining,
    produces: 'Piedra',
    category: 'production',
    effect: '+20 × nivel × 1.1^nivel piedra/h',
    description: 'Extrae bloques de piedra de las colinas circundantes.',
  },
  grainFarm: {
    name: 'Granja',
    Icon: GiGranary,
    produces: 'Grano',
    category: 'production',
    effect: '+10 × nivel × 1.1^nivel grano/h',
    description: 'Cultiva extensos campos de trigo y cebada para la población.',
  },
  windmill: {
    name: 'Molino de Viento',
    Icon: GiWindmill,
    produces: 'Población',
    category: 'production',
    effect: '+20 × nivel × 1.1^nivel población máx',
    description: 'Aumenta la capacidad máxima de población del reino.',
  },
  cathedral: {
    name: 'Catedral',
    Icon: GiChurch,
    produces: 'Grano extra',
    category: 'production',
    effect: '+5 × nivel × 1.1^nivel grano/h adicional',
    description: 'La bendición de la catedral multiplica las cosechas del reino.',
  },
  granary: {
    name: 'Granero de Madera',
    Icon: GiWoodBeam,
    produces: null,
    category: 'storage',
    effect: 'Capacidad de madera: 5000 × ⌊2.5 × e^(20n/33)⌋',
    description: 'Almacena más madera. Cada nivel amplía la capacidad exponencialmente.',
  },
  stonehouse: {
    name: 'Casa de Piedra',
    Icon: GiBrickWall,
    produces: null,
    category: 'storage',
    effect: 'Capacidad de piedra: misma fórmula',
    description: 'Bóvedas de roca que guardan tu reserva de piedra.',
  },
  silo: {
    name: 'Silo',
    Icon: GiGrain,
    produces: null,
    category: 'storage',
    effect: 'Capacidad de grano: misma fórmula',
    description: 'Almacén de grano que evita la pérdida de cosechas.',
  },
  workshop: {
    name: 'Taller',
    Icon: GiAnvil,
    produces: null,
    category: 'infrastructure',
    effect: 'Tiempo de construcción ÷ (1 + nivel)',
    description: 'Mecánicos expertos reducen los tiempos de toda construcción.',
  },
  engineersGuild: {
    name: 'Gremio de Ingenieros',
    Icon: GiGearHammer,
    produces: null,
    category: 'infrastructure',
    effect: 'Tiempo de construcción ÷ 2^nivel (exponencial)',
    description: 'El pináculo de la ingeniería medieval. Acelera la construcción exponencialmente.',
  },
  barracks: {
    name: 'Cuartel',
    Icon: GiMedievalBarracks,
    produces: null,
    category: 'infrastructure',
    effect: 'Desbloquea el entrenamiento de tropas',
    description: 'Entrena guerreros y defensores para proteger el reino.',
  },
  academy: {
    name: 'Academia',
    Icon: GiSpellBook,
    produces: null,
    category: 'infrastructure',
    effect: 'Desbloquea investigaciones, reduce su tiempo',
    description: 'Centro de saber donde se desarrollan nuevas tecnologías.',
  },
  alchemistTower: {
    name: 'Torre del Alquimista',
    Icon: GiMagicGate,
    produces: 'Piedra extra',
    category: 'infrastructure',
    effect: '+15 × nivel × 1.1^nivel piedra/h adicional + investigación más rápida',
    description: 'Los alquimistas purifican minerales y aceleran la investigación.',
  },
  ambassadorHall: {
    name: 'Salón de Embajadores',
    Icon: GiScrollUnfurled,
    produces: null,
    category: 'infrastructure',
    effect: '−5 % tiempo de viaje por nivel (máx. −40 %)',
    description: 'Red diplomática que reduce el tiempo de desplazamiento de ejércitos.',
  },
  armoury: {
    name: 'Armería',
    Icon: GiShieldReflect,
    produces: null,
    category: 'infrastructure',
    effect: 'Desbloquea defensas avanzadas (ballista, trebuchet…)',
    description: 'Forja armaduras y armas para las defensas del reino.',
  },
}

const CATEGORIES: {
  id: 'production' | 'storage' | 'infrastructure'
  label: string
  description: string
  Icon: IconType
  order: string[]
}[] = [
  {
    id: 'production',
    label: 'Producción',
    description:
      'Generan madera, piedra y grano de forma continua. Cuanto más altos, más rápido crece tu reino.',
    Icon: GiFactory,
    order: ['sawmill', 'quarry', 'grainFarm', 'windmill', 'cathedral'],
  },
  {
    id: 'storage',
    label: 'Almacenamiento',
    description:
      'Amplían el límite de recursos. Mejóralos cuando tu producción supere la capacidad actual.',
    Icon: GiOpenTreasureChest,
    order: ['granary', 'stonehouse', 'silo'],
  },
  {
    id: 'infrastructure',
    label: 'Infraestructura',
    description:
      'Desbloquean funciones clave del juego: tropas, investigación, velocidad de construcción.',
    Icon: GiVillage,
    order: [
      'workshop',
      'barracks',
      'academy',
      'alchemistTower',
      'ambassadorHall',
      'armoury',
      'engineersGuild',
    ],
  },
]

const GUIDE_STEPS: { id: string; tip: string }[] = [
  { id: 'sawmill', tip: 'La madera es el recurso más demandado al principio.' },
  { id: 'quarry', tip: 'La piedra es necesaria para casi todos los edificios.' },
  { id: 'grainFarm', tip: 'El grano alimenta tus tropas y habilita la Catedral.' },
  { id: 'windmill', tip: 'Sin población no puedes desplegar unidades en campo.' },
  { id: 'workshop', tip: 'A partir de Nv 2-3 los tiempos de construcción se reducen a la mitad.' },
  { id: 'barracks', tip: 'Necesitas el Cuartel para entrenar cualquier unidad militar.' },
  { id: 'academy', tip: 'La Academia desbloquea toda la investigación.' },
]

const GUIDE_STORAGE_KEY = 'feudum_guide_dismissed'

// ── Page ──────────────────────────────────────────────────────────────────────

export function BuildingsPage() {
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useBuildings()
  const { data: kingdom } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const upgrade = useUpgradeBuilding()
  const accelerate = useAccelerate()
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideDismissed, setGuideDismissed] = useState(
    () => localStorage.getItem(GUIDE_STORAGE_KEY) === '1'
  )

  const handleCountdownEnd = useCallback(() => {
    refetch()
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }, [refetch, qc])

  function dismissGuide() {
    localStorage.setItem(GUIDE_STORAGE_KEY, '1')
    setGuideDismissed(true)
    setGuideOpen(false)
  }

  // Auto-complete guide when all steps are done
  useEffect(() => {
    if (guideDismissed || !data?.buildings) return
    const buildingMap = Object.fromEntries(data.buildings.map(b => [b.id, b]))
    const allDone = GUIDE_STEPS.every(s => (buildingMap[s.id]?.level ?? 0) >= 1)
    if (allDone) {
      localStorage.setItem(GUIDE_STORAGE_KEY, '1')
      setGuideDismissed(true)
      setGuideOpen(false)
      toast.success('¡Base inicial completada! Tu reino está listo para crecer.')
    }
  }, [data?.buildings, guideDismissed])

  if (isLoading) return <BuildingsSkeleton />

  const buildingMap = Object.fromEntries((data?.buildings ?? []).map(b => [b.id, b]))

  function canAfford(b: BuildingInfo) {
    return (
      resources.wood >= b.costWood &&
      resources.stone >= b.costStone &&
      resources.grain >= (b.costGrain ?? 0)
    )
  }

  return (
    <div className="space-y-8">
      <div className="anim-fade-up">
        <span className="section-heading">Infraestructura</span>
        <h1 className="page-title mt-0.5">Construcción</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Mejora tus edificios para aumentar la producción y desbloquear nuevas capacidades.
        </p>
      </div>

      {/* Beginner guide */}
      {!guideDismissed && (
        <div className="anim-fade-up-1 rounded-xl border border-gold/25 bg-gradient-to-r from-gold/6 to-transparent overflow-hidden">
          <button
            onClick={() => setGuideOpen(v => !v)}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left"
          >
            <Sparkles size={15} className="text-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-ui text-sm font-semibold text-ink-mid">
                Primeros pasos recomendados
              </span>
              <span className="hidden sm:inline font-body text-xs text-ink-muted/70 ml-2">
                — haz clic para ver la ruta de inicio
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ChevronDown
                size={14}
                className={`text-ink-muted transition-transform ${guideOpen ? 'rotate-180' : ''}`}
              />
              <button
                onClick={e => {
                  e.stopPropagation()
                  dismissGuide()
                }}
                className="p-0.5 rounded text-ink-muted/50 hover:text-ink-muted transition-colors"
                title="No volver a mostrar"
              >
                <X size={13} />
              </button>
            </div>
          </button>

          {guideOpen && (
            <div className="px-5 pb-5 space-y-3 border-t border-gold/15">
              <p className="font-body text-xs text-ink-muted mt-3">
                Esta es la ruta de construcción más eficiente para empezar. No tienes que seguirla
                al pie de la letra, pero es un buen punto de partida.
              </p>
              <div className="space-y-2">
                {GUIDE_STEPS.map((step, i) => {
                  const meta = BUILDING_META[step.id]
                  const b = buildingMap[step.id]
                  const done = (b?.level ?? 0) >= 1
                  return (
                    <div
                      key={step.id}
                      className={`flex items-start gap-3 ${done ? 'opacity-50' : ''}`}
                    >
                      <div
                        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-ui font-bold mt-0.5 ${done ? 'bg-forest/15 text-forest' : 'bg-gold/15 text-gold-dim'}`}
                      >
                        {done ? '✓' : i + 1}
                      </div>
                      <div className="min-w-0">
                        <span className="font-ui text-xs font-semibold text-ink">{meta.name}</span>
                        <span className="font-body text-xs text-ink-muted ml-1.5">
                          — {step.tip}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category sections */}
      {CATEGORIES.map((cat, ci) => {
        const buildings = cat.order.map(id => buildingMap[id]).filter(Boolean)

        return (
          <section
            key={cat.id}
            className={`anim-fade-up-${Math.min(ci + 2, 5) as 1 | 2 | 3 | 4 | 5}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-parchment-warm border border-gold/20 flex items-center justify-center shrink-0">
                <cat.Icon size={17} className="text-gold-dim" />
              </div>
              <div>
                <span className="font-ui text-sm font-bold text-ink uppercase tracking-wider">
                  {cat.label}
                </span>
                <p className="font-body text-xs text-ink-muted/70 mt-0.5 hidden sm:block">
                  {cat.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {buildings.map(b => {
                const meta = BUILDING_META[b.id]
                if (!meta) return null
                const inQueue = !!b.inQueue
                const locked = !b.requiresMet && !inQueue
                return (
                  <BuildingCard
                    key={b.id}
                    building={b}
                    meta={meta}
                    kingdom={kingdom}
                    canAfford={canAfford(b)}
                    isUpgrading={upgrade.isPending && upgrade.variables === b.id}
                    onUpgrade={() => upgrade.mutate(b.id)}
                    onCountdownEnd={handleCountdownEnd}
                    onAccelerate={b.inQueue ? () => accelerate.mutate('building') : undefined}
                    isAccelerating={accelerate.isPending}
                    dimmed={locked}
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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BuildingsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-20" />
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-3 w-64" />
      </div>
      <div className="skeleton h-14 rounded-xl" />
      {[0, 1, 2].map(s => (
        <div key={s}>
          <div className="flex gap-3 mb-4">
            <div className="skeleton w-8 h-8 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-2.5 w-64" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(s === 1 ? 3 : s === 2 ? 4 : 5)].map((_, i) => (
              <Card key={i} className="p-5 space-y-4">
                <div className="flex gap-3">
                  <div className="skeleton w-9 h-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-32" />
                    <div className="skeleton h-2.5 w-full" />
                    <div className="skeleton h-2.5 w-3/4" />
                  </div>
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
