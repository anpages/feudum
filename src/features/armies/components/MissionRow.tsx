import { ArrowLeft, Package, Loader2, Trophy, Skull, Shield, Pickaxe, Undo2, Rocket } from 'lucide-react'
import { GiWoodPile, GiStoneBlock } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useRecallArmy } from '@/features/armies/useArmies'
import { formatResource, formatDuration } from '@/lib/format'
import type { ArmyMission } from '@/shared/types'
import { ALL_UNIT_META, MISSION_META } from '../armiesMeta'
import { useCountdown } from '../hooks/useCountdown'
import { ExpeditionResult } from './ExpeditionResult'
import { MerchantOfferCard } from './MerchantOfferCard'

interface Props {
  mission: ArmyMission
  onEnd: () => void
}

export function MissionRow({ mission, onEnd }: Props) {
  const recall      = useRecallArmy()
  const isMerchant  = mission.state === 'merchant'
  const isReturning = mission.state === 'returning'
  const target      = isReturning ? mission.origin : mission.target
  const targetTime  = isReturning ? (mission.returnTime ?? 0) : mission.arrivalTime
  const secs        = useCountdown(isMerchant ? 0 : targetTime, onEnd)

  if (isMerchant && mission.result?.merchantOffer) {
    return <MerchantOfferCard mission={mission} onEnd={onEnd} />
  }

  const meta     = MISSION_META[mission.missionType]
  const { Icon } = meta
  const unitList = Object.entries(mission.units).filter(
    (entry): entry is [string, number] => (entry[1] ?? 0) > 0
  )

  const result    = mission.result
  const hasResult = result && (
    result.outcome !== undefined ||
    result.delivered !== undefined ||
    ['colonize', 'scavenge', 'pillage', 'deploy', 'expedition', 'missile'].includes(result.type)
  )

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
          isReturning ? 'bg-forest/10 border-forest/20' : 'bg-gold-soft border-gold/20'
        }`}>
          {isReturning
            ? <ArrowLeft size={13} className="text-forest" />
            : <Icon size={13} className={meta.color} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-ui text-sm font-semibold text-ink">{meta.label}</span>
            <Badge variant={isReturning ? 'forest' : 'gold'}>
              {isReturning ? 'Regresando' : 'En camino'}
            </Badge>
            {result?.outcome === 'victory' && <Badge variant="gold">Victoria</Badge>}
            {result?.outcome === 'defeat'  && <Badge variant="crimson">Derrota</Badge>}
          </div>
          <p className="font-body text-xs text-ink-muted mt-0.5">
            {isReturning ? 'Origen' : 'Destino'}: Reino {target.realm} · Región {target.region} · Pos. {target.slot}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-ui text-xs font-semibold text-ink tabular-nums">
            {secs > 0 ? formatDuration(secs) : 'Llegando…'}
          </p>
          <p className="font-body text-[0.65rem] text-ink-muted/60 mt-0.5">
            {isReturning ? 'regreso en' : 'llega en'}
          </p>
        </div>
      </div>

      {/* Units */}
      {unitList.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {unitList.map(([id, n]) => {
            if (id === 'ballistic') {
              return (
                <div key={id} className="flex items-center gap-1 text-xs text-ink-muted">
                  <Rocket size={13} className="text-crimson" />
                  <span className="font-ui tabular-nums">{n.toLocaleString()}</span>
                </div>
              )
            }
            const m = ALL_UNIT_META.find(u => u.id === id)
            return m ? (
              <div key={id} className="flex items-center gap-1 text-xs text-ink-muted">
                <m.Icon size={13} className="text-gold-dim" />
                <span className="font-ui tabular-nums">{n.toLocaleString()}</span>
              </div>
            ) : null
          })}
        </div>
      )}

      {/* Transport / Deploy resources */}
      {(mission.missionType === 'transport' || mission.missionType === 'deploy') &&
        mission.resources.wood + mission.resources.stone + mission.resources.grain > 0 && (
          <div className="flex items-center gap-3 text-xs text-ink-muted flex-wrap">
            <Package size={11} className="shrink-0" />
            {mission.resources.wood  > 0 && <span>🪵 {formatResource(mission.resources.wood)}</span>}
            {mission.resources.stone > 0 && <span>🪨 {formatResource(mission.resources.stone)}</span>}
            {mission.resources.grain > 0 && <span>🌾 {formatResource(mission.resources.grain)}</span>}
          </div>
        )}

      {/* Mission result */}
      {hasResult && (
        <div className="pt-1 border-t border-gold/10 space-y-1.5">
          <MissionResultInline result={result!} />
        </div>
      )}

      {/* Recall */}
      {!isReturning && mission.missionType !== 'missile' && (
        <button
          onClick={() => recall.mutate(mission.id)}
          disabled={recall.isPending}
          className="flex items-center gap-1.5 text-xs font-ui text-ink-muted/60 hover:text-ink-muted transition-colors disabled:opacity-40"
          title="Retirar misión"
        >
          {recall.isPending ? <Loader2 size={10} className="animate-spin" /> : <Undo2 size={10} />}
          Retirar
        </button>
      )}
    </Card>
  )
}

// ── Inline mission result ────────────────────────────────────────────────────

function MissionResultInline({ result }: { result: NonNullable<ArmyMission['result']> }) {
  if (result.outcome === 'victory') {
    const loot   = result.loot   ?? { wood: 0, stone: 0, grain: 0 }
    const debris = result.debris ?? { wood: 0, stone: 0 }
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <Trophy size={11} className="text-gold shrink-0" />
        <span className="font-ui text-xs font-semibold text-gold">Victoria · {result.rounds} rondas</span>
        {(loot.wood > 0 || loot.stone > 0 || loot.grain > 0) && (
          <span className="font-body text-xs text-ink-muted flex items-center gap-2">
            {loot.wood  > 0 && <span className="flex items-center gap-0.5"><GiWoodPile  size={11} /> {formatResource(loot.wood)}</span>}
            {loot.stone > 0 && <span className="flex items-center gap-0.5"><GiStoneBlock size={11} /> {formatResource(loot.stone)}</span>}
            {loot.grain > 0 && <span>🌾 {formatResource(loot.grain)}</span>}
          </span>
        )}
        {(debris.wood > 0 || debris.stone > 0) && (
          <span className="font-body text-xs text-ink-muted/60 flex items-center gap-1">
            <Pickaxe size={10} />
            {debris.wood  > 0 && <span><GiWoodPile  size={10} className="inline" /> {formatResource(debris.wood)}</span>}
            {debris.stone > 0 && <span><GiStoneBlock size={10} className="inline" /> {formatResource(debris.stone)}</span>}
            escombros
          </span>
        )}
      </div>
    )
  }

  if (result.outcome === 'defeat') {
    return (
      <div className="flex items-center gap-2">
        <Skull size={11} className="text-crimson shrink-0" />
        <span className="font-ui text-xs font-semibold text-crimson">Derrota · {result.rounds} rondas</span>
      </div>
    )
  }

  if (result.outcome === 'draw') {
    return (
      <div className="flex items-center gap-2">
        <Shield size={11} className="text-ink-muted shrink-0" />
        <span className="font-ui text-xs font-semibold text-ink-muted">Empate · {result.rounds} rondas</span>
      </div>
    )
  }

  if (result.delivered === true)  return <span className="font-body text-xs text-forest">Recursos entregados</span>
  if (result.delivered === false) return <span className="font-body text-xs text-ink-muted">{result.reason ?? 'No entregado'}</span>

  if (result.type === 'colonize') {
    return result.success
      ? <span className="font-body text-xs text-forest">Colonia fundada: {result.name}</span>
      : <span className="font-body text-xs text-ink-muted">{result.reason ?? 'Colonización fallida'}</span>
  }

  if (result.type === 'deploy') {
    return result.success
      ? <span className="font-body text-xs text-gold">Despliegue completado en {result.target}</span>
      : <span className="font-body text-xs text-ink-muted">{result.reason ?? 'Despliegue fallido'}</span>
  }

  if (result.type === 'pillage') {
    const loot = result.loot ?? { wood: 0, stone: 0, grain: 0 }
    return loot.wood > 0 || loot.stone > 0 || loot.grain > 0 ? (
      <span className="font-body text-xs text-ink-muted flex items-center gap-2">
        <Skull size={10} className="text-crimson" />
        <span className="font-semibold text-crimson">Pillaje</span>
        {loot.wood  > 0 && <span className="flex items-center gap-0.5"><GiWoodPile  size={10} className="inline" /> {formatResource(loot.wood)}</span>}
        {loot.stone > 0 && <span className="flex items-center gap-0.5"><GiStoneBlock size={10} className="inline" /> {formatResource(loot.stone)}</span>}
        {loot.grain > 0 && <span>🌾 {formatResource(loot.grain)}</span>}
      </span>
    ) : <span className="font-body text-xs text-ink-muted/60">NPC sin recursos</span>
  }

  if (result.type === 'scavenge') {
    const c = result.collected ?? { wood: 0, stone: 0 }
    return c.wood > 0 || c.stone > 0 ? (
      <span className="font-body text-xs text-ink-muted flex items-center gap-2">
        <Pickaxe size={10} />
        {c.wood  > 0 && <span className="flex items-center gap-0.5"><GiWoodPile  size={10} className="inline" /> {formatResource(c.wood)}</span>}
        {c.stone > 0 && <span className="flex items-center gap-0.5"><GiStoneBlock size={10} className="inline" /> {formatResource(c.stone)}</span>}
        recogidos
      </span>
    ) : <span className="font-body text-xs text-ink-muted/60">Sin escombros en el destino</span>
  }

  if (result.type === 'expedition') return <ExpeditionResult result={result} />

  if (result.type === 'missile') {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Rocket size={11} className="text-crimson shrink-0" />
          <span className="font-ui text-xs font-semibold text-crimson">Bombardeo</span>
          {(result.intercepted ?? 0) > 0 && <span className="font-body text-xs text-ink-muted">· {result.intercepted} interceptados</span>}
          {(result.remaining   ?? 0) > 0 && <span className="font-body text-xs text-crimson">· {result.remaining} impactos</span>}
        </div>
        {result.damageDealt && Object.keys(result.damageDealt).length > 0 && (
          <div className="font-body text-xs text-ink-muted pl-4">
            Defensas destruidas: {Object.entries(result.damageDealt).map(([k, v]) => `${v} ${k}`).join(', ')}
          </div>
        )}
        {(result.remaining ?? 0) === 0 && (
          <span className="font-body text-xs text-forest pl-4">Todos los misiles interceptados</span>
        )}
      </div>
    )
  }

  return null
}
