import { Trophy, Skull, Compass, Star, Zap, Clock, Wind } from 'lucide-react'
import { GiWoodPile, GiStoneBlock } from 'react-icons/gi'
import { formatResource } from '@/lib/format'
import { ALL_UNIT_META } from '../armiesMeta'
import type { ArmyMission } from '@/shared/types'

export function ExpeditionResult({ result }: { result: NonNullable<ArmyMission['result']> }) {
  const outcome = result.expeditionOutcome

  if (!outcome || outcome === 'nothing') {
    return <span className="font-body text-xs text-ink-muted/60">La expedición regresó sin novedades.</span>
  }
  if (outcome === 'black_hole') {
    return (
      <span className="font-body text-xs text-crimson flex items-center gap-1.5">
        <Skull size={10} />
        Tormenta Arcana — la flota desapareció en las Tierras Ignotas.
      </span>
    )
  }
  if (outcome === 'resources') {
    const found = (result.found ?? {}) as { wood?: number; stone?: number; grain?: number }
    return (
      <span className="font-body text-xs text-forest flex items-center gap-2">
        <Compass size={10} />
        Botín hallado:
        {(found.wood ?? 0) > 0 && <span className="flex items-center gap-0.5"><GiWoodPile size={10} className="inline" /> {formatResource(found.wood!)}</span>}
        {(found.stone ?? 0) > 0 && <span className="flex items-center gap-0.5"><GiStoneBlock size={10} className="inline" /> {formatResource(found.stone!)}</span>}
        {(found.grain ?? 0) > 0 && <span>🌾 {formatResource(found.grain!)}</span>}
      </span>
    )
  }
  if (outcome === 'units') {
    const found = (result.found ?? {}) as Record<string, number>
    const entries = Object.entries(found).filter(([, n]) => n > 0)
    return (
      <span className="font-body text-xs text-forest flex items-center gap-2">
        <Star size={10} className="text-gold" />
        Supervivientes rescatados:
        {entries.map(([k, n]) => {
          const m = ALL_UNIT_META.find(u => u.id === k)
          return m ? (
            <span key={k} className="flex items-center gap-0.5">
              <m.Icon size={10} className="text-gold-dim" /> {n.toLocaleString()}
            </span>
          ) : null
        })}
      </span>
    )
  }
  if (outcome === 'ether') {
    return (
      <span className="font-body text-xs text-gold flex items-center gap-1.5">
        <Zap size={10} />
        ✨ Éter arcano obtenido: {result.ether ?? 0}
      </span>
    )
  }
  if (outcome === 'delay') {
    return (
      <span className="font-body text-xs text-ink-muted flex items-center gap-1.5">
        <Clock size={10} />
        Caminos perdidos — regreso retrasado (×{result.multiplier ?? 2}).
      </span>
    )
  }
  if (outcome === 'speedup') {
    return (
      <span className="font-body text-xs text-forest flex items-center gap-1.5">
        <Wind size={10} />
        Viento favorable — regreso anticipado.
      </span>
    )
  }
  if (outcome === 'bandits' || outcome === 'demons') {
    const label = outcome === 'bandits' ? 'Merodeadores' : 'Bestias Oscuras'
    if (result.battleOutcome === 'victory') {
      return (
        <span className="font-body text-xs text-gold flex items-center gap-1.5">
          <Trophy size={10} />
          {label} derrotados — la expedición continúa.
        </span>
      )
    }
    return (
      <span className="font-body text-xs text-crimson flex items-center gap-1.5">
        <Skull size={10} />
        {label} — la flota fue destruida.
      </span>
    )
  }
  return null
}
