import { Swords, Eye, Tent, Pickaxe, Package, Flag, Rocket, Compass } from 'lucide-react'
import { GiWoodPile, GiStoneBlock } from 'react-icons/gi'
import { Button } from '@/components/ui/Button'
import { formatResource } from '@/lib/format'
import type { MapSlot } from '@/features/map/useMap'

const POI_ICON: Record<string, string> = {
  yacimiento_madera: '🌲',
  yacimiento_piedra: '⛰️',
  yacimiento_grano:  '🌾',
  reliquia_arcana:   '✨',
  ruinas_antiguas:   '🏛️',
  templo_perdido:    '🕍',
}

export function SlotDetail({
  slot,
  onMission,
}: {
  slot: MapSlot
  onMission: (type: string) => void
}) {
  const hasDebris = slot.debris && (slot.debris.wood > 0 || slot.debris.stone > 0)

  return (
    <div className="p-5 space-y-4">
      {!slot.isEmpty && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-body text-xs text-ink-muted">
            {slot.isNpc ? 'NPC' : `@${slot.username}`}
          </span>
          <span className="font-ui text-xs text-ink-muted tabular-nums ml-auto">
            {slot.points.toLocaleString()} pts
          </span>
        </div>
      )}

      {hasDebris && (
        <div className="rounded border border-gold/15 bg-parchment-warm p-3 space-y-1.5">
          <p className="font-ui text-[0.6rem] text-ink-muted/70 uppercase tracking-widest flex items-center gap-1">
            <Pickaxe size={10} /> Escombros
          </p>
          <div className="flex items-center gap-3 text-xs">
            {slot.debris!.wood > 0 && (
              <span className="flex items-center gap-1 font-ui text-ink-mid">
                <GiWoodPile size={12} className="text-gold-dim" />
                {formatResource(slot.debris!.wood)}
              </span>
            )}
            {slot.debris!.stone > 0 && (
              <span className="flex items-center gap-1 font-ui text-ink-mid">
                <GiStoneBlock size={12} className="text-gold-dim" />
                {formatResource(slot.debris!.stone)}
              </span>
            )}
          </div>
        </div>
      )}

      {slot.poi && (
        <div className={`rounded border p-3 space-y-1.5 ${
          slot.poi.claimed
            ? 'border-gold/30 bg-gold/5'
            : slot.poi.magnitude > 0
              ? 'border-forest/25 bg-forest/5'
              : 'border-ink-muted/20 bg-parchment-warm'
        }`}>
          <p className="font-ui text-[0.6rem] text-ink-muted/70 uppercase tracking-widest flex items-center gap-1">
            <span className="text-sm leading-none">{POI_ICON[slot.poi.type] ?? '✨'}</span>
            {slot.poi.label ?? 'Punto de interés'}
            {slot.poi.claimed && <span className="ml-auto text-gold">reclamado</span>}
          </p>
          {!slot.poi.claimed && (
            <p className="font-body text-xs text-ink-muted">
              {slot.poi.magnitude > 0
                ? `Magnitud restante: ${slot.poi.magnitude}/100 — colonízalo para fijar el bonus permanente.`
                : 'Agotado. Solo el slot vacío sin bonus.'}
            </p>
          )}
        </div>
      )}

      <div className="divider">◆</div>

      <div className="space-y-2">
        {slot.isEmpty ? (
          // Slot vacío: prioriza expedición (más frecuente — descubrir/farmear POI)
          // Colonizar es decisión definitiva, va después.
          <>
            <Button variant="primary" className="w-full" onClick={() => onMission('expedition')}>
              <Compass size={12} /> Expedicionar
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => onMission('colonize')}>
              <Tent size={12} /> Colonizar
            </Button>
          </>
        ) : slot.isPlayer ? (
          // Tu propia colonia: solo misiones logísticas (origen-first paradigm)
          <>
            <Button variant="primary" className="w-full" onClick={() => onMission('transport')}>
              <Package size={12} /> Transportar desde aquí
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => onMission('deploy')}>
              <Flag size={12} /> Desplegar tropas desde aquí
            </Button>
          </>
        ) : (
          // Slot enemigo (NPC o jugador): misiones ofensivas/intel
          <>
            <Button variant="primary" className="w-full" onClick={() => onMission('attack')}>
              <Swords size={12} /> Atacar
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => onMission('spy')}>
              <Eye size={12} /> Espiar
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => onMission('missile')}>
              <Rocket size={12} /> Bombardeo
            </Button>
          </>
        )}
        {hasDebris && (
          <Button variant="ghost" className="w-full" onClick={() => onMission('scavenge')}>
            <Pickaxe size={12} /> Recolectar escombros
          </Button>
        )}
      </div>
    </div>
  )
}
