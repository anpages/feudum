import { ChevronDown, Sparkles, X } from 'lucide-react'
import { BUILDING_META, GUIDE_STEPS } from '../buildingsMeta'
import type { BuildingInfo } from '../types'

export function BeginnerGuide({
  open,
  buildingMap,
  onToggle,
  onDismiss,
}: {
  open: boolean
  buildingMap: Record<string, BuildingInfo>
  onToggle: () => void
  onDismiss: () => void
}) {
  return (
    <div className="anim-fade-up-1 rounded-xl border border-gold/25 bg-gradient-to-r from-gold/6 to-transparent overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-3.5 text-left">
        <Sparkles size={15} className="text-gold shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-ui text-sm font-semibold text-ink-mid">Primeros pasos recomendados</span>
          <span className="hidden sm:inline font-body text-xs text-ink-muted/70 ml-2">— haz clic para ver la ruta de inicio</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ChevronDown size={14} className={`text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
          <button
            onClick={e => { e.stopPropagation(); onDismiss() }}
            className="p-0.5 rounded text-ink-muted/50 hover:text-ink-muted transition-colors"
            title="No volver a mostrar"
          >
            <X size={13} />
          </button>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-gold/15">
          <p className="font-body text-xs text-ink-muted mt-3">
            Esta es la ruta de construcción más eficiente para empezar. No tienes que seguirla al pie de la letra, pero es un buen punto de partida.
          </p>
          <div className="space-y-2">
            {GUIDE_STEPS.map((step, i) => {
              const meta = BUILDING_META[step.id]
              const done = (buildingMap[step.id]?.level ?? 0) >= 1
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
  )
}
