import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Home, Castle, User, Bot, MapPin, X, Swords, Eye, Tent, Pickaxe, Package } from 'lucide-react'
import { GiWoodPile, GiStoneBlock } from 'react-icons/gi'
import { useMap, type MapSlot } from '@/hooks/useMap'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatResource } from '@/lib/format'

export function MapPage() {
  const navigate = useNavigate()
  const [realm,  setRealm]  = useState(1)
  const [region, setRegion] = useState(1)
  const [selected, setSelected] = useState<MapSlot | null>(null)

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

  function handleSelectSlot(slot: MapSlot) {
    if (slot.isPlayer) return
    setSelected(prev => prev?.slot === slot.slot ? null : slot)
  }

  function sendMission(type: string) {
    if (!selected) return
    navigate(`/armies?realm=${realm}&region=${region}&slot=${selected.slot}&type=${type}`)
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

        <div className="flex items-center gap-1.5">
          <span className="section-heading mb-0 mr-1">Reino</span>
          <button
            onClick={() => { setRealm(r => Math.max(1, r - 1)); setSelected(null) }}
            disabled={realm <= 1}
            className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
          ><ChevronLeft size={14} /></button>
          <span className="font-ui font-semibold text-ink w-6 text-center tabular-nums">{realm}</span>
          <button
            onClick={() => { setRealm(r => Math.min(maxRealm, r + 1)); setSelected(null) }}
            disabled={realm >= maxRealm}
            className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
          ><ChevronRight size={14} /></button>
        </div>

        <span className="text-ink-muted/30 font-ui">·</span>

        <div className="flex items-center gap-1.5">
          <span className="section-heading mb-0 mr-1">Región</span>
          <button
            onClick={() => { setRegion(r => Math.max(1, r - 1)); setSelected(null) }}
            disabled={region <= 1}
            className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
          ><ChevronLeft size={14} /></button>
          <span className="font-ui font-semibold text-ink w-6 text-center tabular-nums">{region}</span>
          <button
            onClick={() => { setRegion(r => Math.min(maxRegion, r + 1)); setSelected(null) }}
            disabled={region >= maxRegion}
            className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
          ><ChevronRight size={14} /></button>
        </div>

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

      <div className="flex items-center gap-2 font-ui text-xs text-ink-muted anim-fade-up-1">
        <MapPin size={11} className="text-gold" />
        <span>Reino <strong className="text-ink">{realm}</strong> · Región <strong className="text-ink">{region}</strong></span>
        {data?.myPosition && data.myPosition.realm === realm && data.myPosition.region === region && (
          <Badge variant="gold">Tu región</Badge>
        )}
      </div>

      {/* Main content: grid + detail panel */}
      <div className={`grid gap-4 anim-fade-up-2 ${selected ? 'lg:grid-cols-[1fr_280px]' : ''}`}>

        {/* Slots grid */}
        {isLoading ? (
          <MapSkeleton />
        ) : (
          <div className="space-y-2">
            {(data?.slots ?? []).map(slot => (
              <SlotRow
                key={slot.slot}
                slot={slot}
                isSelected={selected?.slot === slot.slot}
                onClick={() => handleSelectSlot(slot)}
              />
            ))}
          </div>
        )}

        {/* Detail panel */}
        {selected && (
          <Card className="p-4 space-y-4 h-fit sticky top-20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-ui text-[0.6rem] text-ink-muted/60 uppercase tracking-widest">
                  Pos. {selected.slot}
                </p>
                <p className="font-ui text-sm font-semibold text-ink leading-tight mt-0.5">
                  {selected.isEmpty ? 'Posición vacía' : selected.name}
                </p>
                {!selected.isEmpty && (
                  <p className="font-body text-xs text-ink-muted mt-0.5">
                    {selected.isNpc ? 'NPC' : `@${selected.username}`}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded text-ink-muted hover:text-ink hover:bg-parchment-warm transition-colors shrink-0"
              >
                <X size={13} />
              </button>
            </div>

            {!selected.isEmpty && (
              <div className="flex items-center gap-1.5">
                <span className="font-ui text-xs text-ink-muted">Puntos:</span>
                <span className="font-ui text-xs font-semibold text-ink tabular-nums">
                  {selected.points.toLocaleString()}
                </span>
              </div>
            )}

            {/* Debris */}
            {selected.debris && (selected.debris.wood > 0 || selected.debris.stone > 0) && (
              <div className="rounded border border-gold/15 bg-parchment-warm p-3 space-y-1.5">
                <p className="font-ui text-[0.6rem] text-ink-muted/70 uppercase tracking-widest flex items-center gap-1">
                  <Pickaxe size={10} /> Escombros
                </p>
                <div className="flex items-center gap-3 text-xs">
                  {selected.debris.wood > 0 && (
                    <span className="flex items-center gap-1 font-ui text-ink-mid">
                      <GiWoodPile size={12} className="text-gold-dim" />
                      {formatResource(selected.debris.wood)}
                    </span>
                  )}
                  {selected.debris.stone > 0 && (
                    <span className="flex items-center gap-1 font-ui text-ink-mid">
                      <GiStoneBlock size={12} className="text-gold-dim" />
                      {formatResource(selected.debris.stone)}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="divider">◆</div>

            {/* Action buttons */}
            <div className="space-y-2">
              {selected.isEmpty ? (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => sendMission('colonize')}
                >
                  <Tent size={12} />
                  Colonizar
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => sendMission('attack')}
                  >
                    <Swords size={12} />
                    Atacar
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => sendMission('spy')}
                  >
                    <Eye size={12} />
                    Espiar
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => sendMission('transport')}
                  >
                    <Package size={12} />
                    Transportar
                  </Button>
                </>
              )}
              {selected.debris && (selected.debris.wood > 0 || selected.debris.stone > 0) && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => sendMission('scavenge')}
                >
                  <Pickaxe size={12} />
                  Recolectar escombros
                </Button>
              )}
            </div>
          </Card>
        )}

      </div>
    </div>
  )
}

// ── Slot row ──────────────────────────────────────────────────────────────────

function SlotRow({ slot, isSelected, onClick }: { slot: MapSlot; isSelected: boolean; onClick: () => void }) {
  const isHighlighted = slot.isPlayer
  const hasDebris = slot.debris && (slot.debris.wood > 0 || slot.debris.stone > 0)

  return (
    <div
      onClick={isHighlighted ? undefined : onClick}
      className={`flex items-center gap-4 px-4 py-3 rounded border transition-colors ${
        isHighlighted
          ? 'bg-gold-soft border-gold/30 shadow-sm'
          : isSelected
            ? 'bg-parchment border-gold/40 shadow-sm'
            : slot.isEmpty
              ? 'bg-parchment border-gold/5 opacity-50 cursor-pointer hover:opacity-70'
              : 'bg-white border-gold/10 cursor-pointer hover:border-gold/20 hover:bg-parchment'
      }`}
    >

      <span className={`font-ui text-xs tabular-nums w-5 text-center shrink-0 ${
        isHighlighted ? 'text-gold font-bold' : 'text-ink-muted/50'
      }`}>
        {slot.slot}
      </span>

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

      {/* Debris indicator */}
      {hasDebris && (
        <div className="shrink-0 flex items-center gap-1 text-ink-muted/50 text-xs" title="Escombros de batalla">
          <Pickaxe size={11} />
        </div>
      )}

      {!slot.isEmpty && (
        <div className="shrink-0 text-right">
          <span className="font-ui text-xs text-ink-muted tabular-nums">
            {slot.points.toLocaleString()} pts
          </span>
        </div>
      )}

      <div className="shrink-0 flex items-center gap-1.5">
        {isHighlighted && <Badge variant="gold">Tú</Badge>}
        {slot.isNpc && !slot.isEmpty && <Badge variant="stone">NPC</Badge>}
        {isSelected && !isHighlighted && <Badge variant="gold">▶</Badge>}
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
