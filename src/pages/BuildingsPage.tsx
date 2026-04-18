import { useState, useEffect } from 'react'
import { ArrowUp, Clock, Lock, TrendingUp, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useBuildings, useUpgradeBuilding, type BuildingInfo } from '@/hooks/useBuildings'
import { useKingdom } from '@/hooks/useKingdom'
import { useResourceTicker } from '@/hooks/useResourceTicker'
import { formatResource, formatDuration } from '@/lib/format'

// ── Static metadata not returned by API ───────────────────────────────────────

const BUILDING_META: Record<string, { name: string; description: string; emoji: string; produces: string | null }> = {
  sawmill:        { name: 'Aserradero',           emoji: '🪓', produces: 'Madera',     description: 'Tala los bosques del reino para producir madera sin cesar.' },
  quarry:         { name: 'Cantera',              emoji: '⛏',  produces: 'Piedra',     description: 'Extrae bloques de piedra de las colinas circundantes.' },
  grainFarm:      { name: 'Granja',               emoji: '🌾', produces: 'Grano',      description: 'Cultiva extensos campos de trigo y cebada para la población.' },
  windmill:       { name: 'Molino de Viento',     emoji: '⚙',  produces: 'Población',  description: 'Aumenta la capacidad máxima de población del reino.' },
  workshop:       { name: 'Taller',               emoji: '🔨', produces: null,          description: 'Mecánicos expertos reducen los tiempos de toda construcción.' },
  engineersGuild: { name: 'Gremio de Ingenieros', emoji: '📐', produces: null,          description: 'El pináculo de la ingeniería medieval. Acelera la construcción exponencialmente.' },
  barracks:       { name: 'Cuartel',              emoji: '⚔',  produces: null,          description: 'Entrena guerreros y defensores para proteger el reino.' },
  academy:        { name: 'Academia',             emoji: '📚', produces: null,          description: 'Centro de saber donde se desarrollan nuevas tecnologías.' },
}

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(finishesAt: number | null) {
  const [secs, setSecs] = useState(() => finishesAt ? Math.max(0, finishesAt - Math.floor(Date.now() / 1000)) : 0)

  useEffect(() => {
    if (!finishesAt) return
    const tick = () => setSecs(Math.max(0, finishesAt - Math.floor(Date.now() / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [finishesAt])

  return secs
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function BuildingsPage() {
  const { data, isLoading } = useBuildings()
  const { data: kingdom }   = useKingdom()
  const resources           = useResourceTicker(kingdom)
  const upgrade             = useUpgradeBuilding()

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
                canAfford={canAfford}
                isUpgrading={upgrade.isPending && upgrade.variables === b.id}
                onUpgrade={() => upgrade.mutate(b.id)}
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

function BuildingCard({
  building, meta, canAfford, isUpgrading, onUpgrade, animClass,
}: {
  building: BuildingInfo
  meta: { name: string; description: string; emoji: string; produces: string | null }
  canAfford: boolean
  isUpgrading: boolean
  onUpgrade: () => void
  animClass: string
}) {
  const countdown = useCountdown(building.inQueue?.finishesAt ?? null)
  const inQueue   = !!building.inQueue && countdown > 0

  return (
    <Card className={`p-5 flex flex-col gap-4 ${animClass}`}>

      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5 shrink-0">{meta.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-ui text-sm font-semibold text-ink leading-tight">
              {meta.name}
            </h3>
            <Badge variant={building.level > 0 ? 'gold' : 'stone'} className="shrink-0">
              Nv {inQueue ? `${building.level}→${building.inQueue!.level}` : building.level}
            </Badge>
          </div>
          <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">
            {meta.description}
          </p>
        </div>
      </div>

      {/* Production tag */}
      {meta.produces && (
        <div className="flex items-center gap-1.5 text-forest-light text-xs">
          <TrendingUp size={10} />
          <span className="font-ui font-semibold uppercase tracking-wide">
            Produce: {meta.produces}
          </span>
        </div>
      )}

      <div className="divider">◆</div>

      {/* Cost row */}
      <div className="flex items-center gap-4 text-xs">
        <CostItem emoji="🪵" value={building.costWood}  canAfford={canAfford || inQueue} />
        <CostItem emoji="🪨" value={building.costStone} canAfford={canAfford || inQueue} />
        <div className="flex items-center gap-1 ml-auto text-ink-muted/60">
          <Clock size={10} />
          <span className="font-body">{formatDuration(building.timeSeconds)}</span>
        </div>
      </div>

      {/* Action button */}
      {inQueue ? (
        <div className="mt-auto flex items-center justify-center gap-2 py-2 rounded border border-gold/15 bg-gold-soft text-gold-dim font-ui text-xs font-semibold uppercase tracking-wide">
          <Loader2 size={12} className="animate-spin" />
          En construcción — {formatDuration(countdown)}
        </div>
      ) : !building.requiresMet ? (
        <Button variant="ghost" className="w-full mt-auto" disabled>
          <Lock size={11} />
          Requiere {building.requires?.building} Nv {building.requires?.level}
        </Button>
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

function CostItem({ emoji, value, canAfford }: { emoji: string; value: number; canAfford: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{emoji}</span>
      <span className={`font-ui tabular-nums ${canAfford ? 'text-ink-mid' : 'text-crimson'}`}>
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
