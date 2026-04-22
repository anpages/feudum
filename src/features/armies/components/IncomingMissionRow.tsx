import { Swords, Eye, Rocket, Package, Tent, Shield } from 'lucide-react'
import type { IncomingMission } from '@/shared/types'
import { formatDuration } from '@/lib/format'
import { UNIT_LABELS } from '@/lib/labels'
import { useCountdown } from '../hooks/useCountdown'

const MISSION_ICON: Record<string, typeof Swords> = {
  attack:   Swords,
  spy:      Eye,
  missile:  Rocket,
  transport: Package,
  colonize: Tent,
}

interface Props {
  mission: IncomingMission
}

export function IncomingMissionRow({ mission }: Props) {
  const secs = useCountdown(mission.arrivalTime)
  const isHostile = mission.threatLevel === 'hostile'

  const Icon = MISSION_ICON[mission.missionType] ?? Shield
  const coordLabel = `${mission.origin.realm}:${mission.origin.region}:${mission.origin.slot}`
  const targetLabel = `${mission.target.realm}:${mission.target.region}:${mission.target.slot}`
  const label = mission.missionType === 'attack'   ? 'Ataque'
               : mission.missionType === 'spy'      ? 'Espionaje'
               : mission.missionType === 'missile'  ? 'Bombardeo'
               : mission.missionType === 'transport'? 'Transporte'
               : mission.missionType === 'colonize' ? 'Colonización'
               : mission.missionType

  const unitList = Object.entries(mission.units).filter(
    (e): e is [string, number] => (e[1] ?? 0) > 0
  )

  return (
    <div className={`rounded-xl border p-3 ${
      isHostile
        ? 'border-crimson/30 bg-crimson/5'
        : 'border-gold/20 bg-parchment-warm/40'
    }`}>
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
          isHostile ? 'bg-crimson/10 border-crimson/30' : 'bg-gold-soft border-gold/20'
        }`}>
          <Icon size={13} className={isHostile ? 'text-crimson' : 'text-gold-dim'} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-ui text-xs font-semibold ${isHostile ? 'text-crimson' : 'text-ink'}`}>
              {label}
            </span>
            <span className="font-ui text-[0.6rem] text-ink-muted">
              desde {coordLabel}
              {mission.attackerName && (
                <span className="ml-1 text-ink-mid">({mission.attackerName})</span>
              )}
            </span>
            <span className="font-ui text-[0.6rem] text-ink-muted">→ {targetLabel}</span>
          </div>
          {unitList.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {unitList.map(([unit, count]) => (
                <span key={unit} className="font-ui text-[0.6rem] text-ink-muted tabular-nums">
                  {UNIT_LABELS[unit] ?? unit}: <strong className="text-ink">{count}</strong>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ETA */}
        <div className="shrink-0 text-right">
          <div className={`font-ui text-sm font-bold tabular-nums ${
            secs < 300 ? 'text-crimson animate-pulse' : isHostile ? 'text-crimson' : 'text-gold'
          }`}>
            {formatDuration(secs)}
          </div>
          <div className="font-ui text-[0.55rem] text-ink-muted uppercase tracking-wide">llegada</div>
        </div>
      </div>
    </div>
  )
}
