import { useState, useEffect, memo, type ReactNode } from 'react'
import { ArrowUp, Clock, Loader2, Zap, TreePine, Mountain, Wheat, ListOrdered, X } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RequirementsList } from '@/components/ui/RequirementsList'
import { formatResource, formatDuration } from '@/lib/format'
import type { ResearchInfo } from '@/features/research/useResearch'

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

function CostItem({ icon, value, hasEnough }: { icon: ReactNode; value: number; hasEnough: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink-muted/70">{icon}</span>
      <span className={`font-ui tabular-nums ${hasEnough ? 'text-ink-mid' : 'text-crimson'}`}>
        {formatResource(value)}
      </span>
    </div>
  )
}

interface ResearchCardProps {
  item: ResearchInfo
  meta: { name: string; description: string | ((lv: number) => string); category: string }
  kingdom?: Record<string, unknown> | null
  researchLevels?: Record<string, number>
  canAfford: boolean
  resources?: { wood: number; stone: number; grain: number }
  globalQueueFull: boolean
  isUpgrading: boolean
  onUpgrade: () => void
  onCountdownEnd: () => void
  onAccelerate?: () => void
  isAccelerating?: boolean
  onCancel?: (queueId: string) => void
  isCancelling?: boolean
  animClass: string
}

function ResearchCardImpl({
  item,
  meta,
  kingdom,
  researchLevels,
  canAfford,
  resources,
  globalQueueFull,
  isUpgrading,
  onUpgrade,
  onCountdownEnd,
  onAccelerate,
  isAccelerating,
  onCancel,
  isCancelling,
  animClass,
}: ResearchCardProps) {
  const now = Math.floor(Date.now() / 1000)
  const isPending = !!item.inQueue && item.inQueue.startedAt > now
  const countdown = useCountdown(isPending ? null : (item.inQueue?.finishesAt ?? null), onCountdownEnd)
  const inQueue = !!item.inQueue && (countdown > 0 || isPending)

  return (
    <Card className={`p-5 flex flex-col gap-4 ${animClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-ui text-sm font-semibold text-ink">{meta.name}</h3>
          <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">
            {typeof meta.description === 'function' ? meta.description(item.level) : meta.description}
          </p>
        </div>
        <Badge variant={item.level > 0 ? 'gold' : 'stone'} className="shrink-0">
          Nv {inQueue ? `${item.level}→${item.inQueue!.level}` : item.level}
        </Badge>
      </div>

      <div className="divider">◆</div>

      <div className="flex items-center gap-3 text-xs flex-wrap">
        {item.costWood  > 0 && <CostItem icon={<TreePine  size={13} />} value={item.costWood}  hasEnough={inQueue || !resources || resources.wood  >= item.costWood}  />}
        {item.costStone > 0 && <CostItem icon={<Mountain  size={13} />} value={item.costStone} hasEnough={inQueue || !resources || resources.stone >= item.costStone} />}
        {item.costGrain > 0 && <CostItem icon={<Wheat     size={13} />} value={item.costGrain} hasEnough={inQueue || !resources || resources.grain >= item.costGrain} />}
        <div className="flex items-center gap-1 ml-auto text-ink-muted/60">
          <Clock size={10} />
          <span className="font-body">{formatDuration(item.timeSeconds)}</span>
        </div>
      </div>

      {inQueue && isPending ? (
        <div className="mt-auto space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded border border-gold/10 bg-parchment-warm text-ink-muted font-ui text-xs font-semibold uppercase tracking-wide">
              <ListOrdered size={12} />
              En cola
            </div>
            {onCancel && item.inQueue && (
              <button
                onClick={() => onCancel(item.inQueue!.id)}
                disabled={isCancelling}
                title="Cancelar"
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded border border-crimson/20 text-crimson/60 hover:bg-crimson/10 hover:text-crimson hover:border-crimson/40 transition-colors disabled:opacity-40"
              >
                {isCancelling ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
              </button>
            )}
          </div>
        </div>
      ) : inQueue ? (
        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-center gap-2 py-2 rounded border border-gold/15 bg-gold-soft text-gold-dim font-ui text-xs font-semibold uppercase tracking-wide">
              <Loader2 size={12} className="animate-spin" />
              {countdown > 0 ? formatDuration(countdown) : 'Finalizando…'}
            </div>
            {onCancel && item.inQueue && (
              <button
                onClick={() => onCancel(item.inQueue!.id)}
                disabled={isCancelling}
                title="Cancelar"
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded border border-crimson/20 text-crimson/60 hover:bg-crimson/10 hover:text-crimson hover:border-crimson/40 transition-colors disabled:opacity-40"
              >
                {isCancelling ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
              </button>
            )}
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
      ) : !item.requiresMet ? (
        <div className="mt-auto">
          <RequirementsList requires={item.requires} kingdom={kingdom} research={researchLevels} />
        </div>
      ) : globalQueueFull ? (
        <Button variant="ghost" className="w-full mt-auto" disabled>
          <Clock size={11} /> Cola ocupada
        </Button>
      ) : (
        <Button variant="primary" className="w-full mt-auto" disabled={!canAfford || isUpgrading} onClick={onUpgrade}>
          {isUpgrading ? <Loader2 size={11} className="animate-spin" /> : <ArrowUp size={11} />}
          {canAfford ? `Investigar Nv ${item.level + 1}` : 'Recursos insuficientes'}
        </Button>
      )}
    </Card>
  )
}

export const ResearchCard = memo(ResearchCardImpl, (prev, next) =>
  prev.item === next.item &&
  prev.meta === next.meta &&
  prev.kingdom === next.kingdom &&
  prev.researchLevels === next.researchLevels &&
  prev.canAfford === next.canAfford &&
  prev.resources === next.resources &&
  prev.globalQueueFull === next.globalQueueFull &&
  prev.isUpgrading === next.isUpgrading &&
  prev.isAccelerating === next.isAccelerating &&
  prev.isCancelling === next.isCancelling &&
  prev.animClass === next.animClass
)
