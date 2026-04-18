import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { ArrowUp, Clock, TrendingUp, Loader2, ChevronDown, Sparkles, X } from 'lucide-react'
import { type IconType } from 'react-icons'
import {
  GiLogging, GiMining, GiGranary, GiWindmill,
  GiAnvil, GiGearHammer, GiMedievalBarracks, GiSpellBook,
  GiWoodPile, GiStoneBlock, GiWheat,
  GiWoodBeam, GiBrickWall, GiGrain, GiChurch,
  GiMagicGate, GiScrollUnfurled, GiShieldReflect,
  GiFactory, GiOpenTreasureChest, GiVillage,
} from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useBuildings, useUpgradeBuilding, type BuildingInfo } from '@/features/buildings/useBuildings'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { formatResource, formatDuration } from '@/lib/format'
import { useQueryClient } from '@tanstack/react-query'
import { RequirementsList } from '@/components/ui/RequirementsList'

// ── Static metadata ───────────────────────────────────────────────────────────

const BUILDING_META: Record<string, {
  name: string
  description: string
  effect: string
  Icon: IconType
  produces: string | null
  category: 'production' | 'storage' | 'infrastructure'
}> = {
  sawmill:        { name: 'Aserradero',           Icon: GiLogging,          produces: 'Madera',       category: 'production',      effect: '+30 × nivel × 1.1^nivel madera/h',        description: 'Tala los bosques del reino para producir madera sin cesar.' },
  quarry:         { name: 'Cantera',              Icon: GiMining,           produces: 'Piedra',       category: 'production',      effect: '+20 × nivel × 1.1^nivel piedra/h',        description: 'Extrae bloques de piedra de las colinas circundantes.' },
  grainFarm:      { name: 'Granja',               Icon: GiGranary,          produces: 'Grano',        category: 'production',      effect: '+10 × nivel × 1.1^nivel grano/h',         description: 'Cultiva extensos campos de trigo y cebada para la población.' },
  windmill:       { name: 'Molino de Viento',     Icon: GiWindmill,         produces: 'Población',    category: 'production',      effect: '+20 × nivel × 1.1^nivel población máx',   description: 'Aumenta la capacidad máxima de población del reino.' },
  cathedral:      { name: 'Catedral',             Icon: GiChurch,           produces: 'Grano extra',  category: 'production',      effect: '+5 × nivel × 1.1^nivel grano/h adicional', description: 'La bendición de la catedral multiplica las cosechas del reino.' },
  granary:        { name: 'Granero de Madera',    Icon: GiWoodBeam,         produces: null,           category: 'storage',         effect: 'Capacidad de madera: 5000 × ⌊2.5 × e^(20n/33)⌋',  description: 'Almacena más madera. Cada nivel amplía la capacidad exponencialmente.' },
  stonehouse:     { name: 'Casa de Piedra',       Icon: GiBrickWall,        produces: null,           category: 'storage',         effect: 'Capacidad de piedra: misma fórmula',      description: 'Bóvedas de roca que guardan tu reserva de piedra.' },
  silo:           { name: 'Silo',                 Icon: GiGrain,            produces: null,           category: 'storage',         effect: 'Capacidad de grano: misma fórmula',        description: 'Almacén de grano que evita la pérdida de cosechas.' },
  workshop:       { name: 'Taller',              Icon: GiAnvil,            produces: null,           category: 'infrastructure',  effect: 'Tiempo de construcción ÷ (1 + nivel)',     description: 'Mecánicos expertos reducen los tiempos de toda construcción.' },
  engineersGuild: { name: 'Gremio de Ingenieros', Icon: GiGearHammer,       produces: null,           category: 'infrastructure',  effect: 'Tiempo de construcción ÷ 2^nivel (exponencial)', description: 'El pináculo de la ingeniería medieval. Acelera la construcción exponencialmente.' },
  barracks:       { name: 'Cuartel',             Icon: GiMedievalBarracks, produces: null,           category: 'infrastructure',  effect: 'Desbloquea el entrenamiento de tropas',    description: 'Entrena guerreros y defensores para proteger el reino.' },
  academy:        { name: 'Academia',            Icon: GiSpellBook,        produces: null,           category: 'infrastructure',  effect: 'Desbloquea investigaciones, reduce su tiempo', description: 'Centro de saber donde se desarrollan nuevas tecnologías.' },
  alchemistTower: { name: 'Torre del Alquimista', Icon: GiMagicGate,        produces: 'Piedra extra', category: 'infrastructure',  effect: '+15 × nivel × 1.1^nivel piedra/h adicional + investigación más rápida', description: 'Los alquimistas purifican minerales y aceleran la investigación.' },
  ambassadorHall: { name: 'Salón de Embajadores', Icon: GiScrollUnfurled,   produces: null,           category: 'infrastructure',  effect: '−5 % tiempo de viaje por nivel (máx. −40 %)', description: 'Red diplomática que reduce el tiempo de desplazamiento de ejércitos.' },
  armoury:        { name: 'Armería',             Icon: GiShieldReflect,    produces: null,           category: 'infrastructure',  effect: 'Desbloquea defensas avanzadas (ballista, trebuchet…)', description: 'Forja armaduras y armas para las defensas del reino.' },
}

const CATEGORIES = [
  {
    id:          'production' as const,
    label:       'Producción',
    description: 'Generan madera, piedra y grano de forma continua. Cuanto más altos, más rápido crece tu reino.',
    Icon:        GiFactory,
    order:       ['sawmill', 'quarry', 'grainFarm', 'windmill', 'cathedral'],
  },
  {
    id:          'storage' as const,
    label:       'Almacenamiento',
    description: 'Amplían el límite de recursos. Mejóralos cuando tu producción supere la capacidad actual.',
    Icon:        GiOpenTreasureChest,
    order:       ['granary', 'stonehouse', 'silo'],
  },
  {
    id:          'infrastructure' as const,
    label:       'Infraestructura',
    description: 'Desbloquean funciones clave del juego: tropas, investigación, velocidad de construcción.',
    Icon:        GiVillage,
    order:       ['workshop', 'barracks', 'academy', 'alchemistTower', 'ambassadorHall', 'armoury', 'engineersGuild'],
  },
]

// Recommended build steps for new players
const GUIDE_STEPS: { id: string; tip: string }[] = [
  { id: 'sawmill',   tip: 'La madera es el recurso más demandado al principio.' },
  { id: 'quarry',    tip: 'La piedra es necesaria para casi todos los edificios.' },
  { id: 'grainFarm', tip: 'El grano alimenta tus tropas y habilita la Catedral.' },
  { id: 'windmill',  tip: 'Sin población no puedes desplegar unidades en campo.' },
  { id: 'workshop',  tip: 'A partir de Nv 2-3 los tiempos de construcción se reducen a la mitad.' },
  { id: 'barracks',  tip: 'Necesitas el Cuartel para entrenar cualquier unidad militar.' },
  { id: 'academy',   tip: 'La Academia desbloquea toda la investigación.' },
]

const GUIDE_STORAGE_KEY = 'feudum_guide_dismissed'

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(finishesAt: number | null, onEnd: () => void) {
  const [secs, setSecs] = useState(() =>
    finishesAt ? Math.max(0, finishesAt - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!finishesAt) { setSecs(0); return }
    let fired = false
    const tick = () => {
      const remaining = Math.max(0, finishesAt - Math.floor(Date.now() / 1000))
      setSecs(remaining)
      if (remaining === 0 && !fired) { fired = true; onEnd() }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [finishesAt, onEnd])
  return secs
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BuildingsPage() {
  const qc                           = useQueryClient()
  const { data, isLoading, refetch } = useBuildings()
  const { data: kingdom }            = useKingdom()
  const resources                    = useResourceTicker(kingdom)
  const upgrade                      = useUpgradeBuilding()
  const [guideOpen, setGuideOpen]    = useState(false)
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

  if (isLoading) return <BuildingsSkeleton />

  const buildingMap = Object.fromEntries((data?.buildings ?? []).map(b => [b.id, b]))

  // Per-building affordability
  function canAfford(b: BuildingInfo) {
    return resources.wood >= b.costWood && resources.stone >= b.costStone && resources.grain >= (b.costGrain ?? 0)
  }

  // Priority for sort: inQueue > (requiresMet + canAfford) > (requiresMet + can't afford) > locked
  function priority(b: BuildingInfo): number {
    const q = !!b.inQueue && b.inQueue.finishesAt > Math.floor(Date.now() / 1000)
    if (q) return 0
    if (!b.requiresMet) return 3
    return canAfford(b) ? 1 : 2
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="anim-fade-up">
        <span className="section-heading">Infraestructura</span>
        <h1 className="page-title mt-0.5">Construcción</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Mejora tus edificios para aumentar la producción y desbloquear nuevas capacidades.
        </p>
      </div>

      {/* ── Beginner guide ── */}
      {!guideDismissed && (
        <div className="anim-fade-up-1 rounded-xl border border-gold/25 bg-gradient-to-r from-gold/6 to-transparent overflow-hidden">
          <button
            onClick={() => setGuideOpen(v => !v)}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left"
          >
            <Sparkles size={15} className="text-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-ui text-sm font-semibold text-ink-mid">Primeros pasos recomendados</span>
              <span className="hidden sm:inline font-body text-xs text-ink-muted/70 ml-2">— haz clic para ver la ruta de inicio</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ChevronDown size={14} className={`text-ink-muted transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
              <button
                onClick={e => { e.stopPropagation(); dismissGuide() }}
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
                Esta es la ruta de construcción más eficiente para empezar. No tienes que seguirla al pie de la letra, pero es un buen punto de partida.
              </p>
              <div className="space-y-2">
                {GUIDE_STEPS.map((step, i) => {
                  const meta = BUILDING_META[step.id]
                  const b    = buildingMap[step.id]
                  const done = (b?.level ?? 0) >= 1
                  return (
                    <div key={step.id} className={`flex items-start gap-3 ${done ? 'opacity-50' : ''}`}>
                      <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-ui font-bold mt-0.5 ${done ? 'bg-forest/15 text-forest' : 'bg-gold/15 text-gold-dim'}`}>
                        {done ? '✓' : i + 1}
                      </div>
                      <div className="min-w-0">
                        <span className="font-ui text-xs font-semibold text-ink">{meta.name}</span>
                        <span className="font-body text-xs text-ink-muted ml-1.5">— {step.tip}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Category sections ── */}
      {CATEGORIES.map((cat, ci) => {
        const buildings = cat.order
          .map(id => buildingMap[id])
          .filter(Boolean)
          .sort((a, b) => priority(a) - priority(b))

        return (
          <section key={cat.id} className={`anim-fade-up-${Math.min(ci + 2, 5) as 1|2|3|4|5}`}>
            {/* Category header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-parchment-warm border border-gold/20 flex items-center justify-center shrink-0">
                <cat.Icon size={17} className="text-gold-dim" />
              </div>
              <div>
                <span className="font-ui text-sm font-bold text-ink uppercase tracking-wider">{cat.label}</span>
                <p className="font-body text-xs text-ink-muted/70 mt-0.5 hidden sm:block">{cat.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {buildings.map(b => {
                const meta = BUILDING_META[b.id]
                if (!meta) return null
                const inQueue = !!b.inQueue && b.inQueue.finishesAt > Math.floor(Date.now() / 1000)
                const locked  = !b.requiresMet && !inQueue
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

// ── Building card ─────────────────────────────────────────────────────────────

interface CardProps {
  building:       BuildingInfo
  meta:           typeof BUILDING_META[string]
  kingdom?:       Record<string, unknown> | null
  canAfford:      boolean
  isUpgrading:    boolean
  onUpgrade:      () => void
  onCountdownEnd: () => void
  dimmed:         boolean
}

function BuildingCard({ building, meta, kingdom, canAfford, isUpgrading, onUpgrade, onCountdownEnd, dimmed }: CardProps) {
  const countdown = useCountdown(building.inQueue?.finishesAt ?? null, onCountdownEnd)
  const inQueue   = !!building.inQueue && (countdown > 0 || building.inQueue.finishesAt > Math.floor(Date.now() / 1000))
  const { Icon }  = meta

  return (
    <Card className={`p-5 flex flex-col gap-4 transition-opacity ${dimmed ? 'opacity-50 hover:opacity-80' : ''}`}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
          inQueue ? 'bg-gold/15 border border-gold/30' : 'bg-gold-soft border border-gold/20'
        }`}>
          <Icon size={20} className="text-gold-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-ui text-sm font-semibold text-ink leading-tight">{meta.name}</h3>
            <Badge variant={building.level > 0 ? 'gold' : 'stone'} className="shrink-0">
              {inQueue ? `Nv ${building.level}→${building.inQueue!.level}` : `Nv ${building.level}`}
            </Badge>
          </div>
          <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">{meta.description}</p>
        </div>
      </div>

      {/* Effect / produce line */}
      {meta.produces ? (
        <div className="flex items-center gap-1.5 text-forest-light text-xs">
          <TrendingUp size={10} />
          <span className="font-ui font-semibold uppercase tracking-wide">Produce: {meta.produces}</span>
        </div>
      ) : (
        <p className="font-body text-[0.67rem] text-ink-muted/60 leading-snug italic">{meta.effect}</p>
      )}

      <div className="divider">◆</div>

      {/* Cost row */}
      <div className="flex items-center gap-4 text-xs">
        <CostItem icon={<GiWoodPile size={13} />}   value={building.costWood}  affordable={inQueue || canAfford} />
        <CostItem icon={<GiStoneBlock size={13} />} value={building.costStone} affordable={inQueue || canAfford} />
        {(building.costGrain ?? 0) > 0 && (
          <CostItem icon={<GiWheat size={13} />} value={building.costGrain} affordable={inQueue || canAfford} />
        )}
        <div className="flex items-center gap-1 ml-auto text-ink-muted/60">
          <Clock size={10} />
          <span className="font-body">{formatDuration(building.timeSeconds)}</span>
        </div>
      </div>

      {/* Action */}
      {inQueue ? (
        <div className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded border border-gold/15 bg-gold-soft text-gold-dim font-ui text-xs font-semibold uppercase tracking-wide">
          <Loader2 size={12} className="animate-spin" />
          {countdown > 0 ? formatDuration(countdown) : 'Finalizando…'}
        </div>
      ) : !building.requiresMet ? (
        <div className="mt-auto">
          <RequirementsList requires={building.requires ?? []} kingdom={kingdom} />
        </div>
      ) : (
        <Button
          variant="primary"
          className="w-full mt-auto"
          disabled={!canAfford || isUpgrading}
          onClick={onUpgrade}
        >
          {isUpgrading ? <Loader2 size={11} className="animate-spin" /> : <ArrowUp size={11} />}
          {canAfford ? `Mejorar a Nv ${building.level + 1}` : 'Recursos insuficientes'}
        </Button>
      )}

    </Card>
  )
}

function CostItem({ icon, value, affordable }: { icon: ReactNode; value: number; affordable: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink-muted/70">{icon}</span>
      <span className={`font-ui tabular-nums ${affordable ? 'text-ink-mid' : 'text-crimson'}`}>
        {formatResource(value)}
      </span>
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
