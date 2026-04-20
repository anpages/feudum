import { Swords, Eye, Tent, Pickaxe, Package, Flag, Rocket } from 'lucide-react'
import { GiWoodPile, GiStoneBlock } from 'react-icons/gi'
import { Button } from '@/components/ui/Button'
import { formatResource } from '@/lib/format'
import type { MapSlot } from '@/features/map/useMap'

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

      <div className="divider">◆</div>

      <div className="space-y-2">
        {slot.isEmpty ? (
          <Button variant="primary" className="w-full" onClick={() => onMission('colonize')}>
            <Tent size={12} /> Colonizar
          </Button>
        ) : (
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
            {!slot.isNpc && !slot.isPlayer && (
              <Button variant="ghost" className="w-full" onClick={() => onMission('transport')}>
                <Package size={12} /> Transportar
              </Button>
            )}
            {slot.isPlayer && (
              <Button variant="primary" className="w-full" onClick={() => onMission('deploy')}>
                <Flag size={12} /> Desplegar
              </Button>
            )}
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
