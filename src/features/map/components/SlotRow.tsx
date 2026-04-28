import { memo } from 'react'
import { Castle, User, Bot, Pickaxe, Crown, Plane } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import type { MapSlot } from '@/features/map/useMap'

const POI_ICON: Record<string, string> = {
  yacimiento_madera: '🌲',
  yacimiento_piedra: '⛰️',
  yacimiento_grano:  '🌾',
  reliquia_arcana:   '✨',
  ruinas_antiguas:   '🏛️',
  templo_perdido:    '🕍',
}

const MISSION_LABEL: Record<string, string> = {
  attack: 'Ataque', spy: 'Espía', transport: 'Transporte', deploy: 'Despliegue',
  expedition: 'Expedición', colonize: 'Colonización', scavenge: 'Escombros',
  missile: 'Misil',
}

export const SlotRow = memo(function SlotRow({
  slot,
  isSelected,
  onSelect,
}: {
  slot: MapSlot
  isSelected: boolean
  onSelect: (slot: MapSlot) => void
}) {
  const isHighlighted = slot.isPlayer
  const hasDebris = slot.debris && (slot.debris.wood > 0 || slot.debris.stone > 0)

  return (
    <div
      onClick={isHighlighted ? undefined : () => onSelect(slot)}
      className={`flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 rounded border transition-colors ${
        isHighlighted
          ? 'bg-gold-soft border-gold/30 shadow-sm'
          : isSelected
            ? 'bg-parchment border-gold/40 shadow-sm'
            : slot.isEmpty
              ? 'bg-parchment border-gold/5 opacity-50 cursor-pointer hover:opacity-70'
              : 'bg-white border-gold/10 cursor-pointer hover:border-gold/20 hover:bg-parchment'
      }`}
    >
      <span
        className={`font-ui text-xs tabular-nums w-5 text-center shrink-0 ${
          isHighlighted ? 'text-gold font-bold' : 'text-ink-muted/50'
        }`}
      >
        {slot.slot}
      </span>

      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          slot.isEmpty
            ? 'bg-parchment-warm border border-gold/10'
            : isHighlighted
              ? 'bg-gold/15 border border-gold/30'
              : slot.isNpc
                ? 'bg-parchment-warm border border-gold/15'
                : 'bg-parchment-deep border border-gold/20'
        }`}
      >
        {slot.isEmpty ? (
          <span className="text-ink-muted/20 text-xs">·</span>
        ) : slot.isPrimary ? (
          <Crown size={14} className={isHighlighted ? 'text-gold' : 'text-gold-dim'} />
        ) : isHighlighted ? (
          <Castle size={14} className="text-gold" />
        ) : slot.isNpc ? (
          <Bot size={13} className="text-ink-muted/50" />
        ) : (
          <User size={13} className="text-ink-mid" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {slot.isEmpty ? (
          <span className="font-ui text-xs text-ink-muted/35 italic">Posición vacía</span>
        ) : (
          <>
            <p className={`font-ui text-sm font-medium leading-tight truncate ${isHighlighted ? 'text-gold-dim' : 'text-ink'}`}>
              {slot.name}
            </p>
            <p className="font-body text-xs text-ink-muted truncate">
              {slot.isPlayer ? 'Tu reino' : slot.isNpc ? 'NPC' : `@${slot.username}`}
            </p>
          </>
        )}
      </div>

      {hasDebris && (
        <div className="shrink-0 flex items-center gap-1 text-ink-muted/50 text-xs" title="Escombros de batalla">
          <Pickaxe size={11} />
        </div>
      )}

      {slot.poi && (
        <div
          className={`shrink-0 flex items-center gap-1 text-xs ${
            slot.poi.claimed ? 'text-gold' : slot.poi.magnitude > 0 ? 'text-forest-light' : 'text-ink-muted/40'
          }`}
          title={`${slot.poi.label ?? 'POI'} · magnitud ${slot.poi.magnitude}${slot.poi.claimed ? ' · reclamado' : ''}`}
        >
          <span className="text-sm leading-none">{POI_ICON[slot.poi.type] ?? '✨'}</span>
          {!slot.poi.claimed && slot.poi.magnitude > 0 && (
            <span className="font-ui text-[0.6rem] tabular-nums">{slot.poi.magnitude}</span>
          )}
        </div>
      )}

      {slot.myMission && (
        <div
          className="shrink-0 flex items-center gap-1 text-xs text-gold-dim"
          title={`Tienes ${MISSION_LABEL[slot.myMission.type] ?? slot.myMission.type} en curso (${slot.myMission.state})`}
        >
          <Plane size={11} className="text-gold" />
        </div>
      )}

      {!slot.isEmpty && (
        <div className="hidden sm:block shrink-0 text-right">
          <span className="font-ui text-xs text-ink-muted tabular-nums">
            {slot.points.toLocaleString()} pts
          </span>
        </div>
      )}

      <div className="shrink-0 flex items-center gap-1.5">
        {isHighlighted && <Badge variant="gold">Tú</Badge>}
        {slot.isPrimary && !slot.isEmpty && <Badge variant="gold" className="text-[0.6rem]">capital</Badge>}
        {slot.isNpc && !slot.isEmpty && <Badge variant="stone">NPC</Badge>}
        {isSelected && !isHighlighted && <Badge variant="gold">▶</Badge>}
      </div>
    </div>
  )
})
