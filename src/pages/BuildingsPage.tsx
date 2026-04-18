import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { ArrowUp, Clock, TrendingUp, Loader2 } from 'lucide-react'
import { type IconType } from 'react-icons'
import {
  GiLogging, GiMining, GiGranary, GiWindmill,
  GiAnvil, GiGearHammer, GiMedievalBarracks, GiSpellBook,
  GiWoodPile, GiStoneBlock,
} from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useBuildings, useUpgradeBuilding, type BuildingInfo } from '@/hooks/useBuildings'
import { useKingdom } from '@/hooks/useKingdom'
import { useResourceTicker } from '@/hooks/useResourceTicker'
import { formatResource, formatDuration } from '@/lib/format'
import { useQueryClient } from '@tanstack/react-query'
import { RequirementsList } from '@/components/ui/RequirementsList'

// ── Static metadata ───────────────────────────────────────────────────────────

const BUILDING_META: Record<string, { name: string; description: string; Icon: IconType; produces: string | null }> = {
  sawmill:        { name: 'Aserradero',           Icon: GiLogging,         produces: 'Madera',    description: 'Tala los bosques del reino para producir madera sin cesar.' },
  quarry:         { name: 'Cantera',              Icon: GiMining,          produces: 'Piedra',    description: 'Extrae bloques de piedra de las colinas circundantes.' },
  grainFarm:      { name: 'Granja',               Icon: GiGranary,         produces: 'Grano',     description: 'Cultiva extensos campos de trigo y cebada para la población.' },
  windmill:       { name: 'Molino de Viento',     Icon: GiWindmill,        produces: 'Población', description: 'Aumenta la capacidad máxima de población del reino.' },
  workshop:       { name: 'Taller',               Icon: GiAnvil,           produces: null,        description: 'Mecánicos expertos reducen los tiempos de toda construcción.' },
  engineersGuild: { name: 'Gremio de Ingenieros', Icon: GiGearHammer,      produces: null,        description: 'El pináculo de la ingeniería medieval. Acelera la construcción exponencialmente.' },
  barracks:       { name: 'Cuartel',              Icon: GiMedievalBarracks,produces: null,        description: 'Entrena guerreros y defensores para proteger el reino.' },
  academy:        { name: 'Academia',             Icon: GiSpellBook,       produces: null,        description: 'Centro de saber donde se desarrollan nuevas tecnologías.' },
}

// ── Countdown hook ────────────────────────────────────────────────────────────
// Calls onEnd() once when the countdown reaches zero

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
      if (remaining === 0 && !fired) {
        fired = true
        onEnd()
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [finishesAt, onEnd])

  return secs
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BuildingsPage() {
  const qc                          = useQueryClient()
  const { data, isLoading, refetch } = useBuildings()
  const { data: kingdom }            = useKingdom()
  const resources                    = useResourceTicker(kingdom)
  const upgrade                      = useUpgradeBuilding()

  // Called by any card whose countdown hits zero
  const handleCountdownEnd = useCallback(() => {
    refetch()
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }, [refetch, qc])

  if (isLoading) return <BuildingsSkeleton />

  const buildings = data?.buildings ?? []

  return (
    <div className="space-y-8">

      <div className="anim-fade-up">
        <span className="section-heading">Infraestructura</span>
        <h1 className="page-title mt-0.5">Construcción</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Mejora tus edificios para aumentar la producción y desbloquear nuevas capacidades.
        </p>
      </div>

      <section>
        <span className="section-heading anim-fade-up-1">Edificios disponibles</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {buildings.map((b, i) => {
            const meta = BUILDING_META[b.id]
            if (!meta) return null
            const canAfford = resources.wood >= b.costWood && resources.stone >= b.costStone
            return (
              <BuildingCard
                key={b.id}
                building={b}
                meta={meta}
                kingdom={kingdom}
                canAfford={canAfford}
                isUpgrading={upgrade.isPending && upgrade.variables === b.id}
                onUpgrade={() => upgrade.mutate(b.id)}
                onCountdownEnd={handleCountdownEnd}
                animClass={`anim-fade-up-${Math.min(i + 1, 5) as 1|2|3|4|5}`}
              />
            )
          })}
        </div>
      </section>

    </div>
  )
}

// ── Building card ─────────────────────────────────────────────────────────────

interface CardProps {
  building: BuildingInfo
  meta: { name: string; description: string; Icon: IconType; produces: string | null }
  kingdom?: Record<string, unknown> | null
  canAfford: boolean
  isUpgrading: boolean
  onUpgrade: () => void
  onCountdownEnd: () => void
  animClass: string
}

function BuildingCard({ building, meta, kingdom, canAfford, isUpgrading, onUpgrade, onCountdownEnd, animClass }: CardProps) {
  const countdown = useCountdown(building.inQueue?.finishesAt ?? null, onCountdownEnd)
  const inQueue   = !!building.inQueue && (countdown > 0 || building.inQueue.finishesAt > Math.floor(Date.now() / 1000))
  const { Icon } = meta

  return (
    <Card className={`p-5 flex flex-col gap-4 ${animClass}`}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gold-soft border border-gold/20 flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={20} className="text-gold-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-ui text-sm font-semibold text-ink leading-tight">{meta.name}</h3>
            <Badge variant={building.level > 0 ? 'gold' : 'stone'} className="shrink-0">
              Nv {inQueue ? `${building.level}→${building.inQueue!.level}` : building.level}
            </Badge>
          </div>
          <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">{meta.description}</p>
        </div>
      </div>

      {/* Production tag */}
      {meta.produces && (
        <div className="flex items-center gap-1.5 text-forest-light text-xs">
          <TrendingUp size={10} />
          <span className="font-ui font-semibold uppercase tracking-wide">Produce: {meta.produces}</span>
        </div>
      )}

      <div className="divider">◆</div>

      {/* Cost row */}
      <div className="flex items-center gap-4 text-xs">
        <CostItem icon={<GiWoodPile size={13} />}   value={building.costWood}  affordable={inQueue || canAfford} />
        <CostItem icon={<GiStoneBlock size={13} />} value={building.costStone} affordable={inQueue || canAfford} />
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
          <RequirementsList
            requires={building.requires ? [{ type: 'building', id: building.requires.building, level: building.requires.level }] : []}
            kingdom={kingdom}
          />
        </div>
      ) : (
        <Button
          variant="primary"
          className="w-full mt-auto"
          disabled={!canAfford || isUpgrading}
          onClick={onUpgrade}
        >
          {isUpgrading
            ? <Loader2 size={11} className="animate-spin" />
            : <ArrowUp size={11} />
          }
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
      <div>
        <div className="skeleton h-2.5 w-28 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-5 space-y-4">
              <div className="flex gap-3">
                <div className="skeleton w-8 h-8 rounded" />
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
    </div>
  )
}
