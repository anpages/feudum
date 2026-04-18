import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Package,
  Loader2,
  Trophy,
  Skull,
  Shield,
  Pickaxe,
  Undo2,
  Swords,
  Eye,
  Tent,
  Flag,
} from 'lucide-react'
import { type IconType } from 'react-icons'
import {
  GiLightFighter,
  GiHeavyFighter,
  GiMountedKnight,
  GiKnightBanner,
  GiCrossedSwords,
  GiSiegeTower,
  GiBattleMech,
  GiDragonHead,
  GiTrade,
  GiCaravan,
  GiCampingTent,
  GiVulture,
  GiSpyglass,
  GiWoodPile,
  GiStoneBlock,
} from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useRecallArmy } from '@/features/armies/useArmies'
import { formatResource, formatDuration } from '@/lib/format'
import type { ArmyMission, MissionType } from '@/shared/types'

// ── Unit metadata ─────────────────────────────────────────────────────────────

const ALL_UNIT_META: { id: string; Icon: IconType }[] = [
  { id: 'squire', Icon: GiLightFighter },
  { id: 'knight', Icon: GiHeavyFighter },
  { id: 'paladin', Icon: GiMountedKnight },
  { id: 'warlord', Icon: GiKnightBanner },
  { id: 'grandKnight', Icon: GiCrossedSwords },
  { id: 'siegeMaster', Icon: GiSiegeTower },
  { id: 'warMachine', Icon: GiBattleMech },
  { id: 'dragonKnight', Icon: GiDragonHead },
  { id: 'merchant', Icon: GiTrade },
  { id: 'caravan', Icon: GiCaravan },
  { id: 'colonist', Icon: GiCampingTent },
  { id: 'scavenger', Icon: GiVulture },
  { id: 'scout', Icon: GiSpyglass },
]

// ── Mission meta ──────────────────────────────────────────────────────────────

const MISSION_META: Record<MissionType, { label: string; Icon: typeof Swords; color: string }> = {
  attack: { label: 'Ataque', Icon: Swords, color: 'text-crimson' },
  pillage: { label: 'Pillaje', Icon: Skull, color: 'text-crimson' },
  transport: { label: 'Transporte', Icon: Package, color: 'text-forest' },
  spy: { label: 'Espionaje', Icon: Eye, color: 'text-gold-dim' },
  scavenge: { label: 'Recolección', Icon: Pickaxe, color: 'text-stone' },
  colonize: { label: 'Colonización', Icon: Tent, color: 'text-forest' },
  deploy: { label: 'Despliegue', Icon: Flag, color: 'text-gold' },
}

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(targetSecs: number | null, onEnd?: () => void) {
  const [secs, setSecs] = useState(() =>
    targetSecs ? Math.max(0, targetSecs - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!targetSecs) return
    let fired = false
    const tick = () => {
      const rem = Math.max(0, targetSecs - Math.floor(Date.now() / 1000))
      setSecs(rem)
      if (rem === 0 && !fired) {
        fired = true
        onEnd?.()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetSecs, onEnd])
  return secs
}

// ── MissionRow ────────────────────────────────────────────────────────────────

interface Props {
  mission: ArmyMission
  onEnd: () => void
}

export function MissionRow({ mission, onEnd }: Props) {
  const recall = useRecallArmy()
  const isReturning = mission.state === 'returning'
  const target = isReturning ? mission.origin : mission.target
  const targetTime = isReturning ? (mission.returnTime ?? 0) : mission.arrivalTime
  const secs = useCountdown(targetTime, onEnd)

  const meta = MISSION_META[mission.missionType]
  const { Icon } = meta
  const unitList = Object.entries(mission.units).filter(
    (entry): entry is [string, number] => (entry[1] ?? 0) > 0
  )

  const result = mission.result
  const hasResult =
    result &&
    (result.outcome !== undefined ||
      result.delivered !== undefined ||
      result.type === 'colonize' ||
      result.type === 'scavenge' ||
      result.type === 'pillage' ||
      result.type === 'deploy')

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
            isReturning ? 'bg-forest/10 border-forest/20' : 'bg-gold-soft border-gold/20'
          }`}
        >
          {isReturning ? (
            <ArrowLeft size={13} className="text-forest" />
          ) : (
            <Icon size={13} className={meta.color} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-ui text-sm font-semibold text-ink">{meta.label}</span>
            <Badge variant={isReturning ? 'forest' : 'gold'}>
              {isReturning ? 'Regresando' : 'En camino'}
            </Badge>
            {result?.outcome === 'victory' && <Badge variant="gold">Victoria</Badge>}
            {result?.outcome === 'defeat' && <Badge variant="crimson">Derrota</Badge>}
          </div>
          <p className="font-body text-xs text-ink-muted mt-0.5">
            {isReturning ? 'Origen' : 'Destino'}: Reino {target.realm} · Región {target.region} ·
            Pos. {target.slot}
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
            {mission.resources.wood > 0 && <span>🪵 {formatResource(mission.resources.wood)}</span>}
            {mission.resources.stone > 0 && (
              <span>🪨 {formatResource(mission.resources.stone)}</span>
            )}
            {mission.resources.grain > 0 && (
              <span>🌾 {formatResource(mission.resources.grain)}</span>
            )}
          </div>
        )}

      {/* Mission result */}
      {hasResult && (
        <div className="pt-1 border-t border-gold/10 space-y-1.5">
          {result?.outcome === 'victory' &&
            (() => {
              const loot = result.loot ?? { wood: 0, stone: 0, grain: 0 }
              const debris = result.debris ?? { wood: 0, stone: 0 }
              return (
                <div className="flex items-center gap-3 flex-wrap">
                  <Trophy size={11} className="text-gold shrink-0" />
                  <span className="font-ui text-xs font-semibold text-gold">
                    Victoria · {result.rounds} rondas
                  </span>
                  {(loot.wood > 0 || loot.stone > 0 || loot.grain > 0) && (
                    <span className="font-body text-xs text-ink-muted flex items-center gap-2">
                      {loot.wood > 0 && (
                        <span className="flex items-center gap-0.5">
                          <GiWoodPile size={11} /> {formatResource(loot.wood)}
                        </span>
                      )}
                      {loot.stone > 0 && (
                        <span className="flex items-center gap-0.5">
                          <GiStoneBlock size={11} /> {formatResource(loot.stone)}
                        </span>
                      )}
                      {loot.grain > 0 && <span>🌾 {formatResource(loot.grain)}</span>}
                    </span>
                  )}
                  {(debris.wood > 0 || debris.stone > 0) && (
                    <span className="font-body text-xs text-ink-muted/60 flex items-center gap-1">
                      <Pickaxe size={10} />
                      {debris.wood > 0 && (
                        <span>
                          <GiWoodPile size={10} className="inline" /> {formatResource(debris.wood)}
                        </span>
                      )}
                      {debris.stone > 0 && (
                        <span>
                          <GiStoneBlock size={10} className="inline" />{' '}
                          {formatResource(debris.stone)}
                        </span>
                      )}
                      escombros
                    </span>
                  )}
                </div>
              )
            })()}
          {result?.outcome === 'defeat' && (
            <div className="flex items-center gap-2">
              <Skull size={11} className="text-crimson shrink-0" />
              <span className="font-ui text-xs font-semibold text-crimson">
                Derrota · {result.rounds} rondas
              </span>
            </div>
          )}
          {result?.outcome === 'draw' && (
            <div className="flex items-center gap-2">
              <Shield size={11} className="text-ink-muted shrink-0" />
              <span className="font-ui text-xs font-semibold text-ink-muted">
                Empate · {result.rounds} rondas
              </span>
            </div>
          )}
          {result?.delivered === true && (
            <span className="font-body text-xs text-forest">Recursos entregados</span>
          )}
          {result?.delivered === false && (
            <span className="font-body text-xs text-ink-muted">
              {result.reason ?? 'No entregado'}
            </span>
          )}
          {result?.type === 'spy' && (
            <span className="font-body text-xs text-ink-muted">{result.message}</span>
          )}
          {result?.type === 'colonize' && result.success === true && (
            <span className="font-body text-xs text-forest">Colonia fundada: {result.name}</span>
          )}
          {result?.type === 'colonize' && result.success === false && (
            <span className="font-body text-xs text-ink-muted">
              {result.reason ?? 'Colonización fallida'}
            </span>
          )}
          {result?.type === 'deploy' && result.success === true && (
            <span className="font-body text-xs text-gold">
              Despliegue completado en {result.target}
            </span>
          )}
          {result?.type === 'deploy' && result.success === false && (
            <span className="font-body text-xs text-ink-muted">
              {result.reason ?? 'Despliegue fallido'}
            </span>
          )}
          {result?.type === 'pillage' &&
            (() => {
              const loot = result.loot ?? { wood: 0, stone: 0, grain: 0 }
              return loot.wood > 0 || loot.stone > 0 || loot.grain > 0 ? (
                <span className="font-body text-xs text-ink-muted flex items-center gap-2">
                  <Skull size={10} className="text-crimson" />
                  <span className="font-semibold text-crimson">Pillaje</span>
                  {loot.wood > 0 && (
                    <span className="flex items-center gap-0.5">
                      <GiWoodPile size={10} className="inline" /> {formatResource(loot.wood)}
                    </span>
                  )}
                  {loot.stone > 0 && (
                    <span className="flex items-center gap-0.5">
                      <GiStoneBlock size={10} className="inline" /> {formatResource(loot.stone)}
                    </span>
                  )}
                  {loot.grain > 0 && (
                    <span className="flex items-center gap-0.5">
                      🌾 {formatResource(loot.grain)}
                    </span>
                  )}
                </span>
              ) : (
                <span className="font-body text-xs text-ink-muted/60">NPC sin recursos</span>
              )
            })()}
          {result?.type === 'scavenge' &&
            (() => {
              const c = result.collected ?? { wood: 0, stone: 0 }
              return c.wood > 0 || c.stone > 0 ? (
                <span className="font-body text-xs text-ink-muted flex items-center gap-2">
                  <Pickaxe size={10} />
                  {c.wood > 0 && (
                    <span className="flex items-center gap-0.5">
                      <GiWoodPile size={10} className="inline" /> {formatResource(c.wood)}
                    </span>
                  )}
                  {c.stone > 0 && (
                    <span className="flex items-center gap-0.5">
                      <GiStoneBlock size={10} className="inline" /> {formatResource(c.stone)}
                    </span>
                  )}
                  recogidos
                </span>
              ) : (
                <span className="font-body text-xs text-ink-muted/60">
                  Sin escombros en el destino
                </span>
              )
            })()}
        </div>
      )}

      {/* Recall */}
      {!isReturning && (
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
