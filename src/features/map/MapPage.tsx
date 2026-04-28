import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Home, MapPin, Compass, Search } from 'lucide-react'
import { useMap, type MapSlot } from '@/features/map/useMap'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { Badge } from '@/components/ui/Badge'
import { Sheet } from '@/components/ui/Sheet'
import { SlotRow } from './components/SlotRow'
import { SlotDetail } from './components/SlotDetail'
import { SendMissionDialog } from '@/features/armies/components/SendMissionDialog'
import type { MissionType } from '@/features/armies/useArmies'

export function MapPage() {
  const { data: myKingdom } = useKingdom()
  const [realm, setRealm]   = useState(() => (myKingdom as { realm?: number } | null)?.realm  ?? 1)
  const [region, setRegion] = useState(() => (myKingdom as { region?: number } | null)?.region ?? 1)
  const [selected, setSelected] = useState<MapSlot | null>(null)
  const [centered, setCentered] = useState(!!myKingdom)

  // Dialog state — modal de envío de misión que reemplaza la navegación a /armies/send
  const [dialogTarget,    setDialogTarget]    = useState<{ realm: number; region: number; slot: number } | null>(null)
  const [dialogType,      setDialogType]      = useState<MissionType>('attack')

  // Buscador rápido de coordenada estilo "3:5:7" — útil cuando otro jugador
  // te pasa unas coords (chat futuro) o quieres ir a un sitio específico.
  const [coordInput, setCoordInput] = useState('')
  // Slot pendiente de auto-seleccionar tras el cambio de region (búsqueda)
  const [pendingSelectSlot, setPendingSelectSlot] = useState<number | null>(null)

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

  // Permitir clic en cualquier slot — incluida tu colonia (para transportar/desplegar
  // desde ahí) y slots vacíos (para colonizar/expedicionar).
  const handleSelectSlot = useCallback((slot: MapSlot) => {
    setSelected(prev => (prev?.slot === slot.slot ? null : slot))
  }, [])

  // Abrir modal de misión — reemplaza la navegación a /armies/send
  function sendMission(type: string) {
    if (!selected) return
    setDialogTarget({ realm, region, slot: selected.slot })
    setDialogType(type as MissionType)
    setSelected(null)  // cerrar SlotDetail al abrir modal
  }

  // Parser de coordenadas "R:Re:S" o "R:Re" — navega y opcionalmente selecciona slot.
  function handleCoordSearch() {
    const m = coordInput.trim().match(/^(\d+)[:\s/](\d+)(?:[:\s/](\d+))?$/)
    if (!m) return
    const r  = parseInt(m[1], 10)
    const re = parseInt(m[2], 10)
    const s  = m[3] != null ? parseInt(m[3], 10) : null
    if (r < 1 || r > maxRealm || re < 1 || re > maxRegion) return
    setRealm(r)
    setRegion(re)
    setSelected(null)
    setCoordInput('')
    setPendingSelectSlot(s != null && s >= 1 && s <= 16 ? s : null)
  }

  // Auto-select del slot pendiente cuando los datos de la nueva región se cargan
  if (pendingSelectSlot != null && data?.realm === realm && data?.region === region) {
    const target = data.slots.find(x => x.slot === pendingSelectSlot)
    if (target) {
      setSelected(target)
      setPendingSelectSlot(null)
    } else if (pendingSelectSlot === 16) {
      // Slot 16 no aparece en data.slots (no es un slot normal). Abrir directamente
      // el dialog de expedición a Tierras Ignotas.
      setDialogTarget({ realm, region, slot: 16 })
      setDialogType('expedition')
      setPendingSelectSlot(null)
    }
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

        {/* Buscador rápido de coords R:Re:S */}
        <div className="flex items-center gap-1 ml-auto sm:ml-0">
          <Search size={11} className="text-ink-muted/50" />
          <input
            type="text"
            value={coordInput}
            onChange={e => setCoordInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCoordSearch() }}
            placeholder="3:5:7"
            className="w-20 px-2 py-1 rounded border border-gold/20 bg-white font-ui text-xs tabular-nums placeholder:text-ink-muted/40 focus:outline-none focus:border-gold/40 transition-colors"
          />
          <button
            onClick={handleCoordSearch}
            disabled={!coordInput.trim()}
            className="px-2 py-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 font-ui text-[0.65rem] font-semibold transition-colors"
          >
            Ir
          </button>
        </div>

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
              onClick={() => {
                setDialogTarget({ realm, region, slot: 16 })
                setDialogType('expedition')
              }}
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

      <SendMissionDialog
        open={!!dialogTarget}
        onClose={() => setDialogTarget(null)}
        target={dialogTarget}
        missionType={dialogType}
      />
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
