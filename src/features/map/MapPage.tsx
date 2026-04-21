import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Home, MapPin, Compass } from 'lucide-react'
import { useMap, type MapSlot } from '@/features/map/useMap'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { Badge } from '@/components/ui/Badge'
import { Sheet } from '@/components/ui/Sheet'
import { SlotRow } from './components/SlotRow'
import { SlotDetail } from './components/SlotDetail'

export function MapPage() {
  const navigate = useNavigate()
  const { data: myKingdom } = useKingdom()
  const [realm, setRealm]   = useState(() => (myKingdom as { realm?: number } | null)?.realm  ?? 1)
  const [region, setRegion] = useState(() => (myKingdom as { region?: number } | null)?.region ?? 1)
  const [selected, setSelected] = useState<MapSlot | null>(null)
  const [centered, setCentered] = useState(!!myKingdom)

  // Derived state: when myKingdom loads after first render, center on it once.
  // Setting state during render is the official pattern for derived state.
  if (!centered && myKingdom) {
    const k = myKingdom as { realm: number; region: number }
    setCentered(true)
    setRealm(k.realm)
    setRegion(k.region)
  }

  const { data, isLoading } = useMap(realm, region)

  const maxRealm  = data?.maxRealm  ?? 3
  const maxRegion = data?.maxRegion ?? 10

  function goToMyKingdom() {
    if (data?.myPosition) {
      setRealm(data.myPosition.realm)
      setRegion(data.myPosition.region)
      setSelected(null)
    }
  }

  const handleSelectSlot = useCallback((slot: MapSlot) => {
    if (slot.isPlayer) return
    setSelected(prev => (prev?.slot === slot.slot ? null : slot))
  }, [])

  function sendMission(type: string) {
    if (!selected) return
    navigate(`/armies/send?realm=${realm}&region=${region}&slot=${selected.slot}&type=${type}`)
  }

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Exploración</span>
        <h1 className="page-title mt-0.5">Mapa</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Explora los reinos de todo el universo. 3 reinos · 10 regiones · 15 posiciones.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap anim-fade-up-1">
        <NavStepper label="Reino"  value={realm}  min={1} max={maxRealm}  onChange={v => { setRealm(v); setSelected(null) }} />
        <span className="text-ink-muted/30 font-ui">·</span>
        <NavStepper label="Región" value={region} min={1} max={maxRegion} onChange={v => { setRegion(v); setSelected(null) }} />
        {data?.myPosition && (
          <button
            onClick={goToMyKingdom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/20 text-gold font-ui text-xs font-semibold hover:bg-gold-soft transition-colors ml-auto"
          >
            <Home size={12} /> Mi posición
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 font-ui text-xs text-ink-muted anim-fade-up-1">
        <MapPin size={11} className="text-gold" />
        <span>
          Reino <strong className="text-ink">{realm}</strong> · Región{' '}
          <strong className="text-ink">{region}</strong>
        </span>
        {data?.myPosition && data.myPosition.realm === realm && data.myPosition.region === region && (
          <Badge variant="gold">Tu región</Badge>
        )}
      </div>

      <div className="anim-fade-up-2">
        {isLoading ? (
          <MapSkeleton />
        ) : (
          <div className="space-y-2">
            {(data?.slots ?? []).map(slot => (
              <SlotRow
                key={slot.slot}
                slot={slot}
                isSelected={selected?.slot === slot.slot}
                onSelect={handleSelectSlot}
              />
            ))}
            <button
              onClick={() => navigate(`/armies/send?realm=${realm}&region=${region}&slot=16&type=expedition`)}
              className="w-full flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 rounded border border-gold/20 bg-gold-soft/40 hover:bg-gold-soft transition-colors cursor-pointer"
            >
              <span className="font-ui text-xs tabular-nums w-5 text-center shrink-0 text-gold/60 font-bold">16</span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gold/10 border border-gold/25">
                <Compass size={14} className="text-gold" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-ui text-sm font-medium text-gold-dim leading-tight">Tierras Ignotas</p>
                <p className="font-body text-xs text-ink-muted/60 italic">Slot de expedición · Solo exploración</p>
              </div>
              <Badge variant="gold">Expedición</Badge>
            </button>
          </div>
        )}
      </div>

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Pos. ${selected.slot} — ${selected.isEmpty ? 'Posición vacía' : selected.name}` : ''}
        maxWidth="max-w-md"
      >
        {selected && <SlotDetail slot={selected} onMission={sendMission} />}
      </Sheet>
    </div>
  )
}

function NavStepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="section-heading mb-0 mr-1">{label}</span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
      >
        <ChevronLeft size={14} />
      </button>
      <span className="font-ui font-semibold text-ink w-6 text-center tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

function MapSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(15)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 rounded border border-gold/10 bg-white">
          <div className="skeleton w-5 h-3 rounded" />
          <div className="skeleton w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-40" />
            <div className="skeleton h-2.5 w-24" />
          </div>
          <div className="skeleton h-3 w-16" />
        </div>
      ))}
    </div>
  )
}
