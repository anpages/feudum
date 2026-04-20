import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Castle } from 'lucide-react'
import { useKingdoms, useSwitchKingdom, getActiveKingdomId } from '@/features/kingdom/useKingdom'

export function KingdomSelector({ kingdomName }: { kingdomName?: string }) {
  const { data } = useKingdoms()
  const switchKingdom = useSwitchKingdom()
  const activeId = getActiveKingdomId()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const kingdoms = data?.kingdoms ?? []
  const hasMultiple = kingdoms.length > 1

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!kingdomName) return null

  if (!hasMultiple) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-0.5 font-ui text-[0.65rem] text-ink-muted hover:text-ink leading-tight mt-px transition-colors"
      >
        <span className="truncate max-w-[90px]">{kingdomName}</span>
        <ChevronDown size={10} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-gold/20 rounded-lg shadow-lg py-1 min-w-[160px]">
          {kingdoms.map(k => (
            <button
              key={k.id}
              onClick={() => { switchKingdom(k.id === activeId ? null : k.id); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                k.id === activeId || (!activeId && kingdoms[0]?.id === k.id)
                  ? 'bg-gold/8 text-gold-dim'
                  : 'text-ink-muted hover:bg-parchment hover:text-ink'
              }`}
            >
              <Castle size={11} className="shrink-0" />
              <div className="min-w-0">
                <p className="font-ui text-xs font-medium truncate">{k.name}</p>
                <p className="font-body text-[0.6rem] text-ink-muted/60">R{k.realm}·{k.region}·{k.slot}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
