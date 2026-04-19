import { useState, useEffect, memo, type ReactNode } from 'react'
import { Sword, Shield, Heart, Clock, Loader2, Plus, Minus, Zap } from 'lucide-react'
import { type IconType } from 'react-icons'
import { GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RequirementsList } from '@/components/ui/RequirementsList'
import { formatResource, formatDuration } from '@/lib/format'
import type { UnitInfo } from '@/features/barracks/useBarracks'
import type { ResearchInfo } from '@/features/research/useResearch'

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(finishesAt: number | null, onEnd: () => void) {
  const [secs, setSecs] = useState(() =>
    finishesAt ? Math.max(0, finishesAt - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!finishesAt) return
    let fired = false
    const tick = () => {
      const rem = Math.max(0, finishesAt - Math.floor(Date.now() / 1000))
      setSecs(rem)
      if (rem === 0 && !fired) { fired = true; onEnd() }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [finishesAt, onEnd])
  return secs
}

// ── CostItem ──────────────────────────────────────────────────────────────────

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

// ── UnitCard ──────────────────────────────────────────────────────────────────

interface Props {
  unit: UnitInfo
  meta: { name: string; Icon: IconType; description: string }
  resources: { wood: number; stone: number; grain: number }
  kingdom?: Record<string, unknown> | null
  research?: ResearchInfo[] | null
  isTraining: boolean
  onTrain: (amount: number) => void
  onCountdownEnd: () => void
  onAccelerate?: () => void
  isAccelerating?: boolean
  animClass?: string
}

function UnitCardImpl({
  unit, meta, resources, kingdom, research,
  isTraining, onTrain, onCountdownEnd, onAccelerate, isAccelerating,
  animClass = '',
}: Props) {
  const [amount, setAmount] = useState(1)
  const countdown = useCountdown(unit.inQueue?.finishesAt ?? null, onCountdownEnd)
  const inQueue = !!unit.inQueue && countdown > 0

  const totalWood  = unit.woodBase  * amount
  const totalStone = unit.stoneBase * amount
  const totalGrain = unit.grainBase * amount
  const canAfford = resources.wood >= totalWood && resources.stone >= totalStone && resources.grain >= totalGrain
  const totalTime = unit.timePerUnit * amount

  const changeAmount = (delta: number) => setAmount(a => Math.max(1, Math.min(a + delta, 9999)))
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
            <h3 className="font-ui text-sm font-semibold text-ink">{meta.name}</h3>
            <Badge variant={unit.count > 0 ? 'gold' : 'stone'} className="shrink-0">
              {unit.count.toLocaleString()}
            </Badge>
          </div>
          <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">{meta.description}</p>
        </div>
      </div>

      {/* Stats */}
      {(unit.attack > 0 || unit.shield > 0 || unit.hull > 0) && (
        <div className="flex items-center gap-3 text-xs">
          {unit.attack > 0 && (
            <div className="flex items-center gap-1 text-crimson">
              <Sword size={10} /><span className="font-ui tabular-nums">{formatResource(unit.attack)}</span>
            </div>
          )}
          {unit.shield > 0 && (
            <div className="flex items-center gap-1 text-gold-dim">
              <Shield size={10} /><span className="font-ui tabular-nums">{formatResource(unit.shield)}</span>
            </div>
          )}
          {unit.hull > 0 && (
            <div className="flex items-center gap-1 text-forest">
              <Heart size={10} /><span className="font-ui tabular-nums">{formatResource(unit.hull)}</span>
            </div>
          )}
        </div>
      )}

      <div className="divider">◆</div>

      {/* Cost */}
      <div className="flex items-center gap-3 text-xs flex-wrap">
        {totalWood  > 0 && <CostItem icon={<GiWoodPile size={13} />}  value={totalWood}  affordable={inQueue || canAfford} />}
        {totalStone > 0 && <CostItem icon={<GiStoneBlock size={13} />} value={totalStone} affordable={inQueue || canAfford} />}
        {totalGrain > 0 && <CostItem icon={<GiWheat size={13} />}     value={totalGrain} affordable={inQueue || canAfford} />}
        <div className="flex items-center gap-1 ml-auto text-ink-muted/60">
          <Clock size={10} /><span className="font-body">{formatDuration(totalTime)}</span>
        </div>
      </div>

      {/* Action */}
      {inQueue ? (
        <div className="mt-auto space-y-2">
          <div className="flex items-center justify-center gap-2 py-2.5 rounded border border-gold/15 bg-gold-soft text-gold-dim font-ui text-xs font-semibold uppercase tracking-wide">
            <Loader2 size={12} className="animate-spin" />
            {unit.inQueue!.amount} unid. · {countdown > 0 ? formatDuration(countdown) : 'Finalizando…'}
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
      ) : !unit.requiresMet ? (
        <div className="mt-auto">
          <RequirementsList
            requires={unit.requires}
            kingdom={kingdom}
            research={research ? Object.fromEntries(research.map(r => [r.id, r.level])) : {}}
          />
        </div>
      ) : (
        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => changeAmount(-10)} className="hidden sm:block px-1.5 py-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm text-xs font-ui transition-colors shrink-0">-10</button>
            <button onClick={() => changeAmount(-1)} className="p-1.5 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm transition-colors shrink-0"><Minus size={11} /></button>
            <input
              type="number" min={1} max={9999} value={amount}
              onChange={e => setAmount(Math.max(1, Math.min(parseInt(e.target.value) || 1, 9999)))}
              className="flex-1 min-w-0 text-center game-input py-1 text-sm tabular-nums"
            />
            <button onClick={() => changeAmount(1)} className="p-1.5 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm transition-colors shrink-0"><Plus size={11} /></button>
            <button onClick={() => changeAmount(10)} className="hidden sm:block px-1.5 py-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm text-xs font-ui transition-colors shrink-0">+10</button>
          </div>
          <Button variant="primary" className="w-full" disabled={!canAfford || isTraining} onClick={() => onTrain(amount)}>
            {isTraining ? <Loader2 size={11} className="animate-spin" /> : <Sword size={11} />}
            {canAfford ? `Entrenar ×${amount}` : 'Recursos insuficientes'}
          </Button>
        </div>
      )}
    </Card>
  )
}

export const UnitCard = memo(UnitCardImpl, (prev, next) =>
  prev.unit === next.unit &&
  prev.meta === next.meta &&
  prev.kingdom === next.kingdom &&
  prev.research === next.research &&
  prev.resources.wood === next.resources.wood &&
  prev.resources.stone === next.resources.stone &&
  prev.resources.grain === next.resources.grain &&
  prev.isTraining === next.isTraining &&
  prev.isAccelerating === next.isAccelerating &&
  prev.animClass === next.animClass
)
