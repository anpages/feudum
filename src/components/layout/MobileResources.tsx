import { useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Zap, TreePine, Mountain, Wheat } from 'lucide-react'
import { formatResource } from '@/lib/format'
import type { AuthUser } from '@/shared/types/user'

function DropdownResource({ icon, label, value, cap, rate, full }: {
  icon: ReactNode; label: string; value: number; cap?: number; rate?: number; full: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={full ? 'text-crimson' : 'text-gold'}>{icon}</span>
      <span className="font-body text-xs text-ink-muted flex-1">{label}</span>
      <div className="text-right">
        <span className={`font-ui text-xs tabular-nums font-semibold ${full ? 'text-crimson' : 'text-ink-mid'}`}>
          {formatResource(value)}
        </span>
        {cap !== undefined && (
          <span className="font-ui text-[0.6rem] text-ink-muted/50 tabular-nums">
            /{formatResource(cap)}
          </span>
        )}
        {rate !== undefined && rate > 0 && (
          <span className="font-ui text-[0.6rem] text-forest-light tabular-nums block">
            +{formatResource(rate)}/h
          </span>
        )}
      </div>
    </div>
  )
}

export function MobileResources({ resources, kingdom, user }: {
  resources: { wood: number; stone: number; grain: number }
  kingdom: Record<string, unknown> | null | undefined
  user: AuthUser | null
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const woodCap   = kingdom?.woodCapacity  as number | undefined
  const stoneCap  = kingdom?.stoneCapacity as number | undefined
  const grainCap  = kingdom?.grainCapacity as number | undefined
  const woodFull  = woodCap  !== undefined && resources.wood  >= woodCap
  const stoneFull = stoneCap !== undefined && resources.stone >= stoneCap
  const grainFull = grainCap !== undefined && resources.grain >= grainCap

  const produced = (kingdom?.energyProduced as number | undefined) ?? 0
  const consumed = (kingdom?.energyConsumed as number | undefined) ?? 0
  const energyDeficit = produced > 0 && produced < consumed
  const anyAlert = woodFull || stoneFull || grainFull || energyDeficit

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 px-2 py-1 rounded-md transition-colors ${open ? 'bg-parchment/60' : 'hover:bg-parchment/40'}`}
      >
        <span className={`font-ui text-xs tabular-nums font-semibold ${woodFull  ? 'text-crimson' : 'text-ink-mid'}`}>{formatResource(resources.wood)}</span>
        <span className="text-ink-muted/30 text-[10px]">·</span>
        <span className={`font-ui text-xs tabular-nums font-semibold ${stoneFull ? 'text-crimson' : 'text-ink-mid'}`}>{formatResource(resources.stone)}</span>
        <span className="text-ink-muted/30 text-[10px]">·</span>
        <span className={`font-ui text-xs tabular-nums font-semibold ${grainFull ? 'text-crimson' : 'text-ink-mid'}`}>{formatResource(resources.grain)}</span>
        {anyAlert && <span className="w-1.5 h-1.5 rounded-full bg-crimson animate-pulse" />}
        {open ? <ChevronUp size={11} className="text-ink-muted" /> : <ChevronDown size={11} className="text-ink-muted" />}
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-white border border-gold/20 rounded-xl shadow-xl py-3 px-4 min-w-[220px] space-y-3">
          <div className="space-y-2">
            <p className="font-ui text-[0.6rem] text-ink-muted/60 uppercase tracking-widest">Recursos</p>
            <DropdownResource icon={<TreePine  size={13} />} label="Madera" value={resources.wood}  cap={woodCap}  rate={kingdom?.woodProduction  as number | undefined} full={woodFull} />
            <DropdownResource icon={<Mountain size={13} />} label="Piedra" value={resources.stone} cap={stoneCap} rate={kingdom?.stoneProduction as number | undefined} full={stoneFull} />
            <DropdownResource icon={<Wheat    size={13} />} label="Grano"  value={resources.grain} cap={grainCap} rate={kingdom?.grainProduction as number | undefined} full={grainFull} />
          </div>

          {(produced > 0 || consumed > 0) && (
            <div className="border-t border-gold/10 pt-3 space-y-1">
              <p className="font-ui text-[0.6rem] text-ink-muted/60 uppercase tracking-widest">Energía</p>
              <div className="flex items-center justify-between">
                <span className="font-body text-xs text-ink-muted">Producida</span>
                <span className="font-ui text-xs tabular-nums text-forest-light">{formatResource(produced)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body text-xs text-ink-muted">Consumida</span>
                <span className="font-ui text-xs tabular-nums text-ink-mid">{formatResource(consumed)}</span>
              </div>
              {energyDeficit && (
                <p className="font-ui text-[0.65rem] text-crimson font-semibold mt-1">
                  Déficit — minas al {Math.round((produced / consumed) * 100)}%
                </p>
              )}
            </div>
          )}

          <div className="border-t border-gold/10 pt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap size={11} className="text-gold" />
              <span className="font-ui text-xs text-ink-muted">Éter arcano</span>
            </div>
            <span className={`font-ui text-xs tabular-nums font-semibold ${(user?.ether ?? 0) > 0 ? 'text-gold-dim' : 'text-ink-muted/40'}`}>
              {user?.ether ?? 0}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
