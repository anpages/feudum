import { useState, useEffect, memo, type ReactNode } from 'react'
import { ArrowUp, Clock, TrendingUp, Loader2, Zap } from 'lucide-react'
import { type IconType } from 'react-icons'
import { GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RequirementsList } from '@/components/ui/RequirementsList'
import { formatResource, formatDuration } from '@/lib/format'
import type { BuildingInfo } from '../types'

export interface BuildingMeta {
  name: string
  description: string
  effect: string
  Icon: IconType
  produces: string | null
  category: 'production' | 'storage' | 'infrastructure'
}

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(finishesAt: number | null, onEnd: () => void) {
  const [secs, setSecs] = useState(() =>
    finishesAt ? Math.max(0, finishesAt - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!finishesAt) return
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

// ── Cost item ─────────────────────────────────────────────────────────────────

function CostItem({
  icon,
  value,
  affordable,
}: {
  icon: ReactNode
  value: number
  affordable: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink-muted/70">{icon}</span>
      <span className={`font-ui tabular-nums ${affordable ? 'text-ink-mid' : 'text-crimson'}`}>
        {formatResource(value)}
      </span>
    </div>
  )
}

// ── BuildingCard ──────────────────────────────────────────────────────────────

interface Props {
  building: BuildingInfo
  meta: BuildingMeta
  kingdom?: Record<string, unknown> | null
  canAfford: boolean
  isUpgrading: boolean
  onUpgrade: () => void
  onCountdownEnd: () => void
  onAccelerate?: () => void
  isAccelerating?: boolean
  dimmed: boolean
  animClass?: string
}

function BuildingCardImpl({
  building,
  meta,
  kingdom,
  canAfford,
  isUpgrading,
  onUpgrade,
  onCountdownEnd,
  onAccelerate,
  isAccelerating,
  dimmed,
  animClass = '',
}: Props) {
  const countdown = useCountdown(building.inQueue?.finishesAt ?? null, onCountdownEnd)
  const inQueue = !!building.inQueue && countdown > 0
  const { Icon } = meta

  return (
    <Card
      className={`p-5 flex flex-col gap-4 transition-opacity ${dimmed ? 'opacity-50 hover:opacity-80' : ''} ${animClass}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
            inQueue ? 'bg-gold/15 border border-gold/30' : 'bg-gold-soft border border-gold/20'
          }`}
        >
          <Icon size={20} className="text-gold-dim" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-ui text-sm font-semibold text-ink leading-tight">{meta.name}</h3>
            <Badge variant={building.level > 0 ? 'gold' : 'stone'} className="shrink-0">
              {inQueue ? `Nv ${building.level}→${building.inQueue!.level}` : `Nv ${building.level}`}
            </Badge>
          </div>
          <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">
            {meta.description}
          </p>
        </div>
      </div>

      {/* Effect */}
      {meta.produces ? (
        <div className="flex items-center gap-1.5 text-forest-light text-xs">
          <TrendingUp size={10} />
          <span className="font-ui font-semibold uppercase tracking-wide">
            Produce: {meta.produces}
          </span>
        </div>
      ) : (
        <p className="font-body text-[0.67rem] text-ink-muted/60 leading-snug italic">
          {meta.effect}
        </p>
      )}

      <div className="divider">◆</div>

      {/* Cost row */}
      <div className="flex items-center gap-4 text-xs">
        <CostItem
          icon={<GiWoodPile size={13} />}
          value={building.costWood}
          affordable={inQueue || canAfford}
        />
        <CostItem
          icon={<GiStoneBlock size={13} />}
          value={building.costStone}
          affordable={inQueue || canAfford}
        />
        {(building.costGrain ?? 0) > 0 && (
          <CostItem
            icon={<GiWheat size={13} />}
            value={building.costGrain}
            affordable={inQueue || canAfford}
          />
        )}
        <div className="flex items-center gap-1 ml-auto text-ink-muted/60">
          <Clock size={10} />
          <span className="font-body">{formatDuration(building.timeSeconds)}</span>
        </div>
      </div>

      {/* Action */}
      {inQueue ? (
        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-center gap-2 py-2 rounded border border-gold/15 bg-gold-soft text-gold-dim font-ui text-xs font-semibold uppercase tracking-wide">
            <Loader2 size={12} className="animate-spin" />
            {countdown > 0 ? formatDuration(countdown) : 'Finalizando…'}
          </div>
          {onAccelerate && (
            <button
              onClick={onAccelerate}
              disabled={isAccelerating}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-gold/20 font-ui text-xs text-gold-dim hover:bg-gold-soft transition-colors disabled:opacity-40"
            >
              {isAccelerating ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
              Acelerar · {Math.max(1, Math.ceil(countdown / 600))} Éter
            </button>
          )}
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

// Skip callback props in equality — parents pass inline arrows but the
// callbacks are stateless dispatchers; only data props affect what renders.
export const BuildingCard = memo(BuildingCardImpl, (prev, next) =>
  prev.building === next.building &&
  prev.meta === next.meta &&
  prev.kingdom === next.kingdom &&
  prev.canAfford === next.canAfford &&
  prev.isUpgrading === next.isUpgrading &&
  prev.isAccelerating === next.isAccelerating &&
  prev.dimmed === next.dimmed &&
  prev.animClass === next.animClass
)
