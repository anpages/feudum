import { Sword, Wind, Zap, Skull } from 'lucide-react'
import { GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import { Badge } from '@/components/ui/Badge'
import { ResourcePill } from './ResourcePill'
import { LossTable } from './LossTable'

export function ExpeditionMessageDetail({ data }: { data: Record<string, unknown> }) {
  const outcome = data.outcome as string | undefined

  if (outcome === 'nothing') {
    return (
      <p className="font-body text-sm text-ink-muted">
        Tu expedición regresó sin encontrar nada digno de mención.
      </p>
    )
  }

  if (outcome === 'resources') {
    const found = data.found as { wood?: number; stone?: number; grain?: number } | undefined
    return (
      <div className="space-y-3">
        <Badge variant="forest">
          <GiWoodPile size={9} className="mr-0.5" />
          Recursos encontrados
        </Badge>
        {found && (
          <div className="flex gap-4 flex-wrap">
            {(found.wood ?? 0) > 0 && <ResourcePill icon={<GiWoodPile size={13} />} value={found.wood!} label="Madera" />}
            {(found.stone ?? 0) > 0 && <ResourcePill icon={<GiStoneBlock size={13} />} value={found.stone!} label="Piedra" />}
            {(found.grain ?? 0) > 0 && <ResourcePill icon={<GiWheat size={13} />} value={found.grain!} label="Grano" />}
          </div>
        )}
      </div>
    )
  }

  if (outcome === 'units') {
    const found = data.found as Record<string, number> | undefined
    return (
      <div className="space-y-3">
        <Badge variant="forest">
          <Sword size={9} className="mr-0.5" />
          Supervivientes encontrados
        </Badge>
        {found && Object.keys(found).length > 0 && (
          <LossTable title="Unidades recuperadas" losses={found} />
        )}
      </div>
    )
  }

  if (outcome === 'delay') {
    const mult = data.multiplier as number | undefined
    return (
      <div className="space-y-3">
        <Badge variant="stone">
          <Wind size={9} className="mr-0.5" />
          Expedición retrasada
        </Badge>
        <p className="font-body text-sm text-ink-muted">
          Tu expedición encontró condiciones adversas y tardará {mult ? `${mult}×` : 'más'} en regresar.
        </p>
      </div>
    )
  }

  if (outcome === 'speedup') {
    const frac = data.fraction as number | undefined
    return (
      <div className="space-y-3">
        <Badge variant="forest">
          <Zap size={9} className="mr-0.5" />
          Viento a favor
        </Badge>
        <p className="font-body text-sm text-ink-muted">
          Tu expedición llegó antes de lo esperado{frac ? ` (−${Math.round(frac * 100)}%)` : ''}.
        </p>
      </div>
    )
  }

  if (outcome === 'bandits' || outcome === 'demons') {
    const battleOutcome = data.battleOutcome as string | undefined
    const lostAtk = data.lostAtk as Record<string, number> | undefined
    const lostDef = data.lostDef as Record<string, number> | undefined
    const isVictory = battleOutcome === 'victory'
    const label = outcome === 'bandits' ? 'Merodeadores' : 'Bestias Oscuras'
    return (
      <div className="space-y-4">
        <Badge variant={isVictory ? 'forest' : 'crimson'}>
          <Skull size={9} className="mr-0.5" />
          {label} — {isVictory ? 'Victoria' : 'Derrota'}
        </Badge>
        {!isVictory && (
          <p className="font-body text-xs text-crimson">Tu flota fue destruida.</p>
        )}
        {lostAtk && Object.keys(lostAtk).length > 0 && <LossTable title="Bajas propias" losses={lostAtk} />}
        {lostDef && Object.keys(lostDef).length > 0 && <LossTable title={`Bajas ${label}`} losses={lostDef} />}
      </div>
    )
  }

  if (outcome === 'ether') {
    const amount = data.amount as number | undefined
    return (
      <div className="space-y-3">
        <Badge variant="gold">
          <Zap size={9} className="mr-0.5" />
          Éter Oscuro encontrado
        </Badge>
        <p className="font-body text-sm text-ink">
          Tu expedición regresó con <strong>{amount?.toLocaleString() ?? '?'}</strong> unidades de Éter Oscuro.
        </p>
      </div>
    )
  }

  if (outcome === 'black_hole') {
    return (
      <div className="space-y-3">
        <Badge variant="crimson">
          <Skull size={9} className="mr-0.5" />
          Tormenta Arcana
        </Badge>
        <p className="font-body text-sm text-crimson">
          Tu flota fue absorbida por una Tormenta Arcana. No hubo supervivientes.
        </p>
      </div>
    )
  }

  if (outcome === 'merchant') {
    const expired = data.expired as boolean | undefined
    const accepted = data.accepted as boolean | undefined
    const offer = data.offer as { give?: Record<string, number>; receive?: Record<string, number> } | undefined
    return (
      <div className="space-y-4">
        <Badge variant={accepted ? 'forest' : 'stone'}>
          {expired ? 'Oferta expirada' : accepted ? 'Intercambio completado' : 'Oferta rechazada'}
        </Badge>
        {offer && (
          <div className="space-y-3">
            {offer.give && Object.values(offer.give).some(v => v > 0) && (
              <div>
                <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Entregaste</p>
                <div className="flex gap-4 flex-wrap">
                  {(offer.give.wood ?? 0) > 0 && <ResourcePill icon={<GiWoodPile size={13} />} value={offer.give.wood!} label="Madera" />}
                  {(offer.give.stone ?? 0) > 0 && <ResourcePill icon={<GiStoneBlock size={13} />} value={offer.give.stone!} label="Piedra" />}
                  {(offer.give.grain ?? 0) > 0 && <ResourcePill icon={<GiWheat size={13} />} value={offer.give.grain!} label="Grano" />}
                </div>
              </div>
            )}
            {offer.receive && Object.values(offer.receive).some(v => v > 0) && (
              <div>
                <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Recibiste</p>
                <div className="flex gap-4 flex-wrap">
                  {(offer.receive.wood ?? 0) > 0 && <ResourcePill icon={<GiWoodPile size={13} />} value={offer.receive.wood!} label="Madera" />}
                  {(offer.receive.stone ?? 0) > 0 && <ResourcePill icon={<GiStoneBlock size={13} />} value={offer.receive.stone!} label="Piedra" />}
                  {(offer.receive.grain ?? 0) > 0 && <ResourcePill icon={<GiWheat size={13} />} value={offer.receive.grain!} label="Grano" />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return <p className="font-body text-sm text-ink-muted">Expedición completada.</p>
}
