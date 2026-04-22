import { memo, useState } from 'react'
import {
  ArrowLeft, Loader2, Trophy, Skull, Shield,
  Pickaxe, Undo2, Rocket, ChevronRight, Clock,
} from 'lucide-react'
import { GiWoodPile, GiStoneBlock } from 'react-icons/gi'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useRecallArmy } from '@/features/armies/useArmies'
import { formatResource, formatDuration } from '@/lib/format'
import { UNIT_LABELS } from '@/lib/labels'
import type { ArmyMission } from '@/shared/types'
import { ALL_UNIT_META, MISSION_META } from '../armiesMeta'
import { useCountdown } from '../hooks/useCountdown'
import { ExpeditionResult } from './ExpeditionResult'
import { MerchantOfferCard } from './MerchantOfferCard'

interface Props {
  mission: ArmyMission
  onEnd: () => void
}

function MissionRowImpl({ mission, onEnd }: Props) {
  const [open, setOpen] = useState(false)
  const recall      = useRecallArmy()
  const isMerchant  = mission.state === 'merchant'
  const isReturning = mission.state === 'returning'
  const isExploring = mission.state === 'exploring'
  const canRecall   = !isReturning && !isExploring && mission.missionType !== 'missile'

  const target     = isReturning ? mission.origin : mission.target
  const targetTime = isReturning
    ? (mission.returnTime ?? 0)
    : isExploring
      ? mission.arrivalTime + (mission.holdingTime ?? 0)
      : mission.arrivalTime
  const secs = useCountdown(isMerchant ? 0 : targetTime, onEnd)

  if (isMerchant && mission.result?.merchantOffer) {
    return <MerchantOfferCard mission={mission} onEnd={onEnd} />
  }

  const meta     = MISSION_META[mission.missionType]
  const { Icon } = meta
  const unitList = Object.entries(mission.units).filter(
    (entry): entry is [string, number] => (entry[1] ?? 0) > 0
  )
  const result   = mission.result
  const hasResult = result && (
    result.outcome !== undefined ||
    result.delivered !== undefined ||
    ['colonize', 'scavenge', 'deploy', 'expedition', 'missile'].includes(result.type ?? '')
  )

  const stateLabel = isReturning ? 'Regresando' : isExploring ? 'Explorando' : 'En camino'
  const stateVariant = isReturning ? 'forest' : 'gold'

  const coordLabel = `${target.realm}:${target.region}:${target.slot}`

  return (
    <>
      {/* ── Compact card ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-xl border border-gold/20 bg-parchment p-3 hover:border-gold/40 hover:bg-gold/5 transition-colors"
      >
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
              isReturning ? 'bg-forest/10 border-forest/20' : 'bg-gold-soft border-gold/20'
            }`}>
              {isReturning
                ? <ArrowLeft size={13} className="text-forest" />
                : <Icon size={13} className={meta.color} />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-ui text-sm font-semibold text-ink">{meta.label}</span>
                <Badge variant={stateVariant}>{stateLabel}</Badge>
                {result?.outcome === 'victory' && <Badge variant="gold">Victoria</Badge>}
                {result?.outcome === 'defeat'  && <Badge variant="crimson">Derrota</Badge>}
                {result?.outcome === 'draw'    && <Badge variant="stone">Empate</Badge>}
              </div>
              <p className="font-body text-xs text-ink-muted/60 mt-0.5 truncate">
                {isReturning ? '← ' : '→ '}{coordLabel}
              </p>
            </div>

            {/* Countdown + chevron */}
            <div className="shrink-0 flex items-center gap-2">
              <div className="text-right">
                <p className="font-ui text-sm font-bold text-ink tabular-nums">
                  {secs > 0 ? formatDuration(secs) : 'Llegando…'}
                </p>
                <p className="font-body text-[0.6rem] text-ink-muted/50">
                  {isReturning ? 'vuelta en' : isExploring ? 'explora' : 'llega en'}
                </p>
              </div>
              <ChevronRight size={14} className="text-ink-muted/30" />
            </div>
          </div>
      </button>

      {/* ── Detail Sheet ─────────────────────────────────────────────────── */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`${meta.label} — ${coordLabel}`}
        maxWidth="max-w-lg"
      >
        <div className="p-5 space-y-5 overflow-y-auto">

          {/* State + countdown */}
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-gold/10">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={stateVariant}>{stateLabel}</Badge>
              {result?.outcome === 'victory' && <Badge variant="gold">Victoria</Badge>}
              {result?.outcome === 'defeat'  && <Badge variant="crimson">Derrota</Badge>}
              {result?.outcome === 'draw'    && <Badge variant="stone">Empate</Badge>}
            </div>
            <div className="flex items-center gap-1.5 font-ui text-sm font-bold text-ink tabular-nums shrink-0">
              <Clock size={13} className="text-ink-muted/50" />
              {secs > 0 ? formatDuration(secs) : 'Llegando…'}
            </div>
          </div>

          {/* Route */}
          <div className="space-y-2">
            <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted font-semibold">Ruta</p>
            <div className="flex items-center gap-2 font-body text-sm text-ink">
              <span className="text-ink-muted">{mission.origin.realm}:{mission.origin.region}:{mission.origin.slot}</span>
              <span className="text-ink-muted/40">→</span>
              <span className="font-semibold">{mission.target.realm}:{mission.target.region}:{mission.target.slot}</span>
            </div>
          </div>

          {/* Troops */}
          {unitList.length > 0 && (
            <div className="space-y-2">
              <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted font-semibold">Tropas enviadas</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {unitList.map(([id, n]) => {
                  if (id === 'ballistic') return (
                    <div key={id} className="flex items-center justify-between gap-2">
                      <span className="font-body text-xs text-ink-muted flex items-center gap-1.5">
                        <Rocket size={12} className="text-crimson" /> Balística
                      </span>
                      <span className="font-ui text-xs font-semibold tabular-nums">{n.toLocaleString()}</span>
                    </div>
                  )
                  const m = ALL_UNIT_META.find(u => u.id === id)
                  return (
                    <div key={id} className="flex items-center justify-between gap-2">
                      <span className="font-body text-xs text-ink-muted flex items-center gap-1.5">
                        {m && <m.Icon size={12} className="text-gold-dim" />}
                        {UNIT_LABELS[id] ?? id}
                      </span>
                      <span className="font-ui text-xs font-semibold tabular-nums">{n.toLocaleString()}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Resources (transport / deploy) */}
          {(mission.missionType === 'transport' || mission.missionType === 'deploy') &&
            mission.resources.wood + mission.resources.stone + mission.resources.grain > 0 && (
            <div className="space-y-2">
              <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted font-semibold">Recursos transportados</p>
              <div className="flex items-center gap-4 flex-wrap">
                {mission.resources.wood  > 0 && <span className="font-body text-xs text-ink flex items-center gap-1"><GiWoodPile  size={13} /> {formatResource(mission.resources.wood)}</span>}
                {mission.resources.stone > 0 && <span className="font-body text-xs text-ink flex items-center gap-1"><GiStoneBlock size={13} /> {formatResource(mission.resources.stone)}</span>}
                {mission.resources.grain > 0 && <span className="font-body text-xs text-ink">🌾 {formatResource(mission.resources.grain)}</span>}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-1.5 rounded-lg bg-parchment-deep border border-gold/15 p-3">
            <TimelineRow label="Salida"   time={mission.departureTime} done />
            <TimelineRow label="Llegada"  time={mission.arrivalTime}   done={Date.now()/1000 >= mission.arrivalTime} />
            {mission.holdingTime > 0 && (
              <TimelineRow label="Fin exploración" time={mission.arrivalTime + mission.holdingTime} done={isReturning} />
            )}
            {mission.returnTime && (
              <TimelineRow label="Regreso" time={mission.returnTime} done={false} />
            )}
          </div>

          {/* Mission result */}
          {hasResult && (
            <div className="space-y-1 pt-1 border-t border-gold/10">
              <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted font-semibold mb-2">Resultado</p>
              <MissionResultInline result={result!} />
            </div>
          )}

          {/* Recall */}
          {canRecall && (
            <div className="pt-2 border-t border-gold/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { recall.mutate(mission.id); setOpen(false) }}
                disabled={recall.isPending}
              >
                {recall.isPending ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                Retirar misión
              </Button>
            </div>
          )}
        </div>
      </Sheet>
    </>
  )
}

export const MissionRow = memo(MissionRowImpl, (prev, next) => prev.mission === next.mission)

// ── Timeline row ──────────────────────────────────────────────────────────────

function TimelineRow({ label, time, done }: { label: string; time: number; done: boolean }) {
  const d = new Date(time * 1000)
  const hhmm = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const date = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${done ? 'bg-forest' : 'bg-gold/40'}`} />
        <span className={`font-body text-xs ${done ? 'text-ink-muted/50' : 'text-ink-muted'}`}>{label}</span>
      </div>
      <span className={`font-ui text-xs tabular-nums ${done ? 'text-ink-muted/50' : 'text-ink'}`}>
        {date !== today ? `${date} ` : ''}{hhmm}
      </span>
    </div>
  )
}

// ── Inline mission result ────────────────────────────────────────────────────

function MissionResultInline({ result }: { result: NonNullable<ArmyMission['result']> }) {
  if (result.outcome === 'victory') {
    const loot   = result.loot   ?? { wood: 0, stone: 0, grain: 0 }
    const debris = result.debris ?? { wood: 0, stone: 0 }
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Trophy size={12} className="text-gold shrink-0" />
          <span className="font-ui text-sm font-semibold text-gold">Victoria · {result.rounds} rondas</span>
        </div>
        {(loot.wood > 0 || loot.stone > 0 || loot.grain > 0) && (
          <div className="flex items-center gap-3 pl-5 flex-wrap">
            {loot.wood  > 0 && <span className="font-body text-xs text-ink-muted flex items-center gap-1"><GiWoodPile  size={11} /> {formatResource(loot.wood)}</span>}
            {loot.stone > 0 && <span className="font-body text-xs text-ink-muted flex items-center gap-1"><GiStoneBlock size={11} /> {formatResource(loot.stone)}</span>}
            {loot.grain > 0 && <span className="font-body text-xs text-ink-muted">🌾 {formatResource(loot.grain)}</span>}
          </div>
        )}
        {(debris.wood > 0 || debris.stone > 0) && (
          <div className="flex items-center gap-2 pl-5 text-ink-muted/60">
            <Pickaxe size={10} />
            <span className="font-body text-xs flex items-center gap-1">
              {debris.wood  > 0 && <span className="flex items-center gap-0.5"><GiWoodPile  size={10} /> {formatResource(debris.wood)}</span>}
              {debris.stone > 0 && <span className="flex items-center gap-0.5"><GiStoneBlock size={10} /> {formatResource(debris.stone)}</span>}
              escombros generados
            </span>
          </div>
        )}
      </div>
    )
  }

  if (result.outcome === 'defeat') return (
    <div className="flex items-center gap-2">
      <Skull size={12} className="text-crimson shrink-0" />
      <span className="font-ui text-sm font-semibold text-crimson">Derrota · {result.rounds} rondas</span>
    </div>
  )

  if (result.outcome === 'draw') return (
    <div className="flex items-center gap-2">
      <Shield size={12} className="text-ink-muted shrink-0" />
      <span className="font-ui text-sm font-semibold text-ink-muted">Empate · {result.rounds} rondas</span>
    </div>
  )

  if (result.delivered === true)  return <span className="font-body text-sm text-forest">✓ Recursos entregados</span>
  if (result.delivered === false) return <span className="font-body text-sm text-ink-muted">{result.reason ?? 'No entregado'}</span>

  if (result.type === 'colonize') return result.success
    ? <span className="font-body text-sm text-forest">Colonia fundada: {result.name}</span>
    : <span className="font-body text-sm text-ink-muted">{result.reason ?? 'Colonización fallida'}</span>

  if (result.type === 'deploy') return result.success
    ? <span className="font-body text-sm text-gold">Despliegue completado en {result.target}</span>
    : <span className="font-body text-sm text-ink-muted">{result.reason ?? 'Despliegue fallido'}</span>

  if (result.type === 'scavenge') {
    const c = result.collected ?? { wood: 0, stone: 0 }
    return c.wood > 0 || c.stone > 0 ? (
      <div className="flex items-center gap-2 flex-wrap">
        <Pickaxe size={12} className="text-ink-muted shrink-0" />
        {c.wood  > 0 && <span className="font-body text-xs text-ink flex items-center gap-1"><GiWoodPile  size={11} /> {formatResource(c.wood)}</span>}
        {c.stone > 0 && <span className="font-body text-xs text-ink flex items-center gap-1"><GiStoneBlock size={11} /> {formatResource(c.stone)}</span>}
        <span className="font-body text-xs text-ink-muted">recogidos</span>
      </div>
    ) : <span className="font-body text-sm text-ink-muted/60">Sin escombros en el destino</span>
  }

  if (result.type === 'expedition') return <ExpeditionResult result={result} />

  if (result.type === 'missile') return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Rocket size={12} className="text-crimson shrink-0" />
        <span className="font-ui text-sm font-semibold text-crimson">Bombardeo</span>
        {(result.intercepted ?? 0) > 0 && <span className="font-body text-xs text-ink-muted">· {result.intercepted} interceptados</span>}
        {(result.remaining   ?? 0) > 0 && <span className="font-body text-xs text-crimson">· {result.remaining} impactos</span>}
      </div>
      {result.damageDealt && Object.keys(result.damageDealt).length > 0 && (
        <p className="font-body text-xs text-ink-muted pl-5">
          Destruidas: {Object.entries(result.damageDealt).map(([k, v]) => `${v} ${UNIT_LABELS[k] ?? k}`).join(', ')}
        </p>
      )}
      {(result.remaining ?? 0) === 0 && (
        <span className="font-body text-xs text-forest pl-5">Todos los misiles interceptados</span>
      )}
    </div>
  )

  return null
}
