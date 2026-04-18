import { useState } from 'react'
import { ChevronLeft, ChevronRight, Home, Castle, User, Bot, MapPin } from 'lucide-react'
import { useMap, type MapSlot } from '@/hooks/useMap'
import { Badge } from '@/components/ui/Badge'

export function MapPage() {
  const [realm,  setRealm]  = useState(1)
  const [region, setRegion] = useState(1)

  const { data, isLoading } = useMap(realm, region)

  const maxRealm  = data?.maxRealm  ?? 3
  const maxRegion = data?.maxRegion ?? 10

  function goToMyKingdom() {
    if (data?.myPosition) {
      setRealm(data.myPosition.realm)
      setRegion(data.myPosition.region)
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="anim-fade-up">
        <span className="section-heading">Exploración</span>
        <h1 className="page-title mt-0.5">Mapa</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Explora los reinos de todo el universo. 3 reinos · 10 regiones · 15 posiciones.
        </p>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-3 flex-wrap anim-fade-up-1">

        {/* Realm selector */}
        <div className="flex items-center gap-1.5">
          <span className="section-heading mb-0 mr-1">Reino</span>
          <button
            onClick={() => setRealm(r => Math.max(1, r - 1))}
            disabled={realm <= 1}
            className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
          ><ChevronLeft size={14} /></button>
          <span className="font-ui font-semibold text-ink w-6 text-center tabular-nums">{realm}</span>
          <button
            onClick={() => setRealm(r => Math.min(maxRealm, r + 1))}
            disabled={realm >= maxRealm}
            className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
          ><ChevronRight size={14} /></button>
        </div>

        <span className="text-ink-muted/30 font-ui">·</span>

        {/* Region selector */}
        <div className="flex items-center gap-1.5">
          <span className="section-heading mb-0 mr-1">Región</span>
          <button
            onClick={() => setRegion(r => Math.max(1, r - 1))}
            disabled={region <= 1}
            className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
          ><ChevronLeft size={14} /></button>
          <span className="font-ui font-semibold text-ink w-6 text-center tabular-nums">{region}</span>
          <button
            onClick={() => setRegion(r => Math.min(maxRegion, r + 1))}
            disabled={region >= maxRegion}
            className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
          ><ChevronRight size={14} /></button>
        </div>

        {/* Jump to my kingdom */}
        {data?.myPosition && (
          <button
            onClick={goToMyKingdom}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-gold/20 text-gold font-ui text-xs font-semibold hover:bg-gold-soft transition-colors ml-auto"
          >
            <Home size={12} />
            Mi posición
          </button>
        )}
      </div>

      {/* Coordinate display */}
      <div className="flex items-center gap-2 font-ui text-xs text-ink-muted anim-fade-up-1">
        <MapPin size={11} className="text-gold" />
        <span>Reino <strong className="text-ink">{realm}</strong> · Región <strong className="text-ink">{region}</strong></span>
        {data?.myPosition && data.myPosition.realm === realm && data.myPosition.region === region && (
          <Badge variant="gold">Tu región</Badge>
        )}
      </div>

      {/* Slots grid */}
      {isLoading ? (
        <MapSkeleton />
      ) : (
        <div className="space-y-2 anim-fade-up-2">
          {(data?.slots ?? []).map(slot => (
            <SlotRow key={slot.slot} slot={slot} />
          ))}
        </div>
      )}

    </div>
  )
}

// ── Slot row ──────────────────────────────────────────────────────────────────

function SlotRow({ slot }: { slot: MapSlot }) {
  const isHighlighted = slot.isPlayer

  return (
    <div className={`flex items-center gap-4 px-4 py-3 rounded border transition-colors ${
      isHighlighted
        ? 'bg-gold-soft border-gold/30 shadow-sm'
        : slot.isEmpty
          ? 'bg-parchment border-gold/5 opacity-50'
          : 'bg-white border-gold/10 hover:border-gold/20 hover:bg-parchment'
    }`}>

      {/* Slot number */}
      <span className={`font-ui text-xs tabular-nums w-5 text-center shrink-0 ${
        isHighlighted ? 'text-gold font-bold' : 'text-ink-muted/50'
      }`}>
        {slot.slot}
      </span>

      {/* Planet icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        slot.isEmpty
          ? 'bg-parchment-warm border border-gold/10'
          : isHighlighted
            ? 'bg-gold/15 border border-gold/30'
            : slot.isNpc
              ? 'bg-parchment-warm border border-gold/15'
              : 'bg-parchment-deep border border-gold/20'
      }`}>
        {slot.isEmpty
          ? <span className="text-ink-muted/20 text-xs">·</span>
          : isHighlighted
            ? <Castle size={14} className="text-gold" />
            : slot.isNpc
              ? <Bot size={13} className="text-ink-muted/50" />
              : <User size={13} className="text-ink-mid" />
        }
      </div>

      {/* Kingdom info */}
      <div className="flex-1 min-w-0">
        {slot.isEmpty ? (
          <span className="font-ui text-xs text-ink-muted/35 italic">Posición vacía</span>
        ) : (
          <>
            <p className={`font-ui text-sm font-medium leading-tight truncate ${
              isHighlighted ? 'text-gold-dim' : 'text-ink'
            }`}>
              {slot.name}
            </p>
            <p className="font-body text-xs text-ink-muted truncate">
              {slot.isPlayer ? 'Tu reino' : slot.isNpc ? 'NPC' : `@${slot.username}`}
            </p>
          </>
        )}
      </div>

      {/* Points */}
      {!slot.isEmpty && (
        <div className="shrink-0 text-right">
          <span className="font-ui text-xs text-ink-muted tabular-nums">
            {slot.points.toLocaleString()} pts
          </span>
        </div>
      )}

      {/* Badges */}
      <div className="shrink-0 flex items-center gap-1.5">
        {isHighlighted && <Badge variant="gold">Tú</Badge>}
        {slot.isNpc && !slot.isEmpty && <Badge variant="stone">NPC</Badge>}
      </div>

    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

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
