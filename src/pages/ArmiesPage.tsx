import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Send, Shield, Swords, Eye, Package, ChevronLeft, ChevronRight, Loader2, ArrowLeft, Trophy, Skull, Pickaxe, Undo2, Tent } from 'lucide-react'
import { type IconType } from 'react-icons'
import {
  GiLightFighter, GiHeavyFighter, GiMountedKnight, GiKnightBanner,
  GiCrossedSwords, GiSiegeTower, GiBattleMech, GiDragonHead,
  GiTrade, GiCaravan, GiCampingTent, GiVulture, GiSpyglass,
  GiWoodPile, GiStoneBlock,
} from 'react-icons/gi'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useArmies, useSendArmy, useRecallArmy, type MissionType, type ArmyMission } from '@/hooks/useArmies'
import { useKingdom } from '@/hooks/useKingdom'
import { formatResource, formatDuration } from '@/lib/format'

// ── Unit metadata ─────────────────────────────────────────────────────────────

const COMBAT_UNITS: { id: string; name: string; Icon: IconType }[] = [
  { id: 'squire',       name: 'Escudero',           Icon: GiLightFighter  },
  { id: 'knight',       name: 'Caballero',          Icon: GiHeavyFighter  },
  { id: 'paladin',      name: 'Paladín',            Icon: GiMountedKnight },
  { id: 'warlord',      name: 'Señor de la Guerra', Icon: GiKnightBanner  },
  { id: 'grandKnight',  name: 'Gran Caballero',     Icon: GiCrossedSwords },
  { id: 'siegeMaster',  name: 'Maestro de Asedio',  Icon: GiSiegeTower    },
  { id: 'warMachine',   name: 'Máquina de Guerra',  Icon: GiBattleMech    },
  { id: 'dragonKnight', name: 'Caballero Dragón',   Icon: GiDragonHead    },
]
const SUPPORT_UNITS: { id: string; name: string; Icon: IconType }[] = [
  { id: 'merchant',  name: 'Mercader',   Icon: GiTrade      },
  { id: 'caravan',   name: 'Caravana',   Icon: GiCaravan    },
  { id: 'colonist',  name: 'Colonista',  Icon: GiCampingTent},
  { id: 'scavenger', name: 'Carroñero',  Icon: GiVulture    },
  { id: 'scout',     name: 'Explorador', Icon: GiSpyglass   },
]
const ALL_UNIT_META = [...COMBAT_UNITS, ...SUPPORT_UNITS]

const MISSION_META: Record<MissionType, { label: string; Icon: typeof Swords; color: string; desc: string }> = {
  attack:   { label: 'Ataque',       Icon: Swords,   color: 'text-crimson',  desc: 'Atacar y saquear el reino objetivo.' },
  transport:{ label: 'Transporte',   Icon: Package,  color: 'text-forest',   desc: 'Transportar recursos al reino objetivo.' },
  spy:      { label: 'Espionaje',    Icon: Eye,      color: 'text-gold-dim', desc: 'Solo Exploradores. Recopila información.' },
  scavenge: { label: 'Recolección',  Icon: Pickaxe,  color: 'text-stone',    desc: 'Envía Carroñeros a recolectar escombros de batalla.' },
  colonize: { label: 'Colonización', Icon: Tent,     color: 'text-forest',   desc: 'Envía Colonistas a fundar una nueva colonia.' },
}

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(targetSecs: number | null, onEnd?: () => void) {
  const [secs, setSecs] = useState(() =>
    targetSecs ? Math.max(0, targetSecs - Math.floor(Date.now() / 1000)) : 0
  )
  useEffect(() => {
    if (!targetSecs) { setSecs(0); return }
    let fired = false
    const tick = () => {
      const rem = Math.max(0, targetSecs - Math.floor(Date.now() / 1000))
      setSecs(rem)
      if (rem === 0 && !fired) { fired = true; onEnd?.() }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetSecs, onEnd])
  return secs
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ArmiesPage() {
  const qc                          = useQueryClient()
  const { data: armies, isLoading } = useArmies()
  const { data: kingdom }           = useKingdom()
  const send                        = useSendArmy()
  const [searchParams]              = useSearchParams()

  const initRealm  = Math.max(1, parseInt(searchParams.get('realm')  ?? '1', 10) || 1)
  const initRegion = Math.max(1, parseInt(searchParams.get('region') ?? '1', 10) || 1)
  const initSlot   = Math.max(1, parseInt(searchParams.get('slot')   ?? '1', 10) || 1)
  const initType   = (searchParams.get('type') ?? 'attack') as MissionType

  const [missionType, setMissionType] = useState<MissionType>(initType)
  const [tRealm,  setTRealm]  = useState(initRealm)
  const [tRegion, setTRegion] = useState(initRegion)
  const [tSlot,   setTSlot]   = useState(initSlot)
  const [units,   setUnits]   = useState<Record<string, number>>({})
  const [resLoad, setResLoad] = useState({ wood: 0, stone: 0, grain: 0 })

  const handleEnd = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['armies'] })
    qc.invalidateQueries({ queryKey: ['kingdom'] })
    qc.invalidateQueries({ queryKey: ['barracks'] })
  }, [qc])

  const setUnit = (id: string, val: string) => {
    const n = Math.max(0, parseInt(val) || 0)
    setUnits(prev => ({ ...prev, [id]: n }))
  }

  const totalUnits = Object.values(units).reduce((s, n) => s + n, 0)
  const canSend    = totalUnits > 0 && !send.isPending

  const handleSend = () => {
    send.mutate({
      missionType,
      target: { realm: tRealm, region: tRegion, slot: tSlot },
      units,
      resources: missionType === 'transport' ? resLoad : undefined,
    }, {
      onSuccess: () => {
        setUnits({})
        setResLoad({ wood: 0, stone: 0, grain: 0 })
      },
    })
  }

  const activeMissions  = armies?.missions.filter(m => m.state === 'active')    ?? []
  const returningMissions = armies?.missions.filter(m => m.state === 'returning') ?? []

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="anim-fade-up">
        <span className="section-heading">Ejército</span>
        <h1 className="page-title mt-0.5">Misiones</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Envía ejércitos a atacar, espiar o transportar recursos entre reinos.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Send form ── */}
        <div className="space-y-4 anim-fade-up-1">
          <h2 className="font-ui text-sm font-semibold text-ink uppercase tracking-widest">Enviar misión</h2>

          {/* Mission type selector */}
          <Card className="p-4 space-y-3">
            <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Tipo de misión</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(MISSION_META) as [MissionType, typeof MISSION_META[MissionType]][]).map(([type, meta]) => {
                const { Icon } = meta
                return (
                  <button
                    key={type}
                    onClick={() => setMissionType(type)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded border transition-all text-xs font-ui font-semibold ${
                      missionType === type
                        ? 'bg-gold-soft border-gold/30 text-gold-dim shadow-sm'
                        : 'border-gold/10 text-ink-muted hover:border-gold/20 hover:bg-parchment'
                    }`}
                  >
                    <Icon size={16} className={missionType === type ? meta.color : ''} />
                    {meta.label}
                  </button>
                )
              })}
            </div>
            <p className="font-body text-xs text-ink-muted">{MISSION_META[missionType].desc}</p>
          </Card>

          {/* Target coordinates */}
          <Card className="p-4 space-y-3">
            <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Destino</p>
            <div className="grid grid-cols-3 gap-2">
              <CoordPicker label="Reino"    value={tRealm}  min={1} max={3}  onChange={setTRealm}  />
              <CoordPicker label="Región"   value={tRegion} min={1} max={10} onChange={setTRegion} />
              <CoordPicker label="Posición" value={tSlot}   min={1} max={15} onChange={setTSlot}   />
            </div>
          </Card>

          {/* Unit selection */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Unidades</p>
              {totalUnits > 0 && (
                <Badge variant="gold">{totalUnits.toLocaleString()} unidades</Badge>
              )}
            </div>
            <div className="space-y-1.5">
              {ALL_UNIT_META.map(u => {
                const available = (kingdom as any)?.[u.id] ?? 0
                if (available === 0) return null
                return (
                  <div key={u.id} className="flex items-center gap-2">
                    <u.Icon size={14} className="text-gold-dim shrink-0" />
                    <span className="font-ui text-xs text-ink flex-1 min-w-0 truncate">{u.name}</span>
                    <span className="font-ui text-xs text-ink-muted tabular-nums shrink-0">{available.toLocaleString()}</span>
                    <input
                      type="number"
                      min={0}
                      max={available}
                      value={units[u.id] ?? 0}
                      onChange={e => setUnit(u.id, e.target.value)}
                      className="game-input w-16 py-1 text-sm text-center tabular-nums shrink-0"
                    />
                  </div>
                )
              })}
              {!kingdom || ALL_UNIT_META.every(u => ((kingdom as any)?.[u.id] ?? 0) === 0) && (
                <p className="font-body text-xs text-ink-muted/50 italic py-2 text-center">
                  No tienes unidades disponibles. Entrena unidades en el Cuartel.
                </p>
              )}
            </div>
          </Card>

          {/* Resource load (transport only) */}
          {missionType === 'transport' && (
            <Card className="p-4 space-y-3">
              <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Recursos a transportar</p>
              <div className="space-y-2">
                {([['wood','🪵','Madera'],['stone','🪨','Piedra'],['grain','🌾','Grano']] as const).map(([key, emoji, label]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-base w-5 text-center">{emoji}</span>
                    <span className="font-ui text-xs text-ink flex-1">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={resLoad[key]}
                      onChange={e => setResLoad(r => ({ ...r, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="game-input w-28 py-1 text-sm text-center tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Error */}
          {send.isError && (
            <p className="font-ui text-xs text-crimson px-1">
              {(send.error as any)?.message ?? 'Error al enviar la misión'}
            </p>
          )}

          <Button
            variant="primary"
            className="w-full"
            disabled={!canSend}
            onClick={handleSend}
          >
            {send.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {send.isPending ? 'Enviando…' : `Enviar ${MISSION_META[missionType].label}`}
          </Button>
        </div>

        {/* ── Active missions ── */}
        <div className="space-y-4 anim-fade-up-2">
          <h2 className="font-ui text-sm font-semibold text-ink uppercase tracking-widest">
            Misiones activas
            {(armies?.missions.length ?? 0) > 0 && (
              <span className="ml-2 font-normal text-ink-muted normal-case tracking-normal">
                ({armies!.missions.length})
              </span>
            )}
          </h2>

          {isLoading ? (
            <MissionsSkeleton />
          ) : armies?.missions.length === 0 ? (
            <Card className="p-6 text-center">
              <Shield size={24} className="text-ink-muted/30 mx-auto mb-2" />
              <p className="font-ui text-xs text-ink-muted/50">No hay misiones activas</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {[...activeMissions, ...returningMissions].map(m => (
                <MissionRow key={m.id} mission={m} onEnd={handleEnd} />
              ))}
            </div>
          )}

        </div>

      </div>
    </div>
  )
}

// ── Coordinate picker ─────────────────────────────────────────────────────────

function CoordPicker({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="section-heading mb-0 text-[0.58rem]">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
        ><ChevronLeft size={11} /></button>
        <span className="font-ui font-semibold text-ink w-6 text-center tabular-nums text-sm">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
        ><ChevronRight size={11} /></button>
      </div>
    </div>
  )
}

// ── Mission row ───────────────────────────────────────────────────────────────

function MissionRow({ mission, onEnd }: { mission: ArmyMission; onEnd: () => void }) {
  const recall      = useRecallArmy()
  const isReturning = mission.state === 'returning'
  const target = isReturning ? mission.origin : mission.target
  const targetTime = isReturning ? (mission.returnTime ?? 0) : mission.arrivalTime
  const secs = useCountdown(targetTime, onEnd)

  const meta   = MISSION_META[mission.missionType]
  const { Icon } = meta
  const unitList = Object.entries(mission.units).filter((entry): entry is [string, number] => (entry[1] ?? 0) > 0)

  const result = mission.result
  const hasResult = result && (result.outcome || result.delivered !== undefined)

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
          isReturning ? 'bg-forest/10 border-forest/20' : 'bg-gold-soft border-gold/20'
        }`}>
          {isReturning
            ? <ArrowLeft size={13} className="text-forest" />
            : <Icon size={13} className={meta.color} />
          }
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

      {/* Battle result */}
      {hasResult && (
        <div className="pt-1 border-t border-gold/10 space-y-1.5">
          {result?.outcome === 'victory' && (() => {
            const loot   = result.loot   ?? { wood: 0, stone: 0, grain: 0 }
            const debris = result.debris ?? { wood: 0, stone: 0 }
            return (
              <div className="flex items-center gap-3 flex-wrap">
                <Trophy size={11} className="text-gold shrink-0" />
                <span className="font-ui text-xs font-semibold text-gold">Victoria · {result.rounds} rondas</span>
                {(loot.wood > 0 || loot.stone > 0 || loot.grain > 0) && (
                  <span className="font-body text-xs text-ink-muted flex items-center gap-2">
                    {loot.wood  > 0 && <span className="flex items-center gap-0.5"><GiWoodPile  size={11} className="text-ink-muted/60" /> {formatResource(loot.wood)}</span>}
                    {loot.stone > 0 && <span className="flex items-center gap-0.5"><GiStoneBlock size={11} className="text-ink-muted/60" /> {formatResource(loot.stone)}</span>}
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
          })()}
          {result?.outcome === 'defeat' && (
            <div className="flex items-center gap-2">
              <Skull size={11} className="text-crimson shrink-0" />
              <span className="font-ui text-xs font-semibold text-crimson">Derrota · {result.rounds} rondas</span>
            </div>
          )}
          {result?.outcome === 'draw' && (
            <div className="flex items-center gap-2">
              <Shield size={11} className="text-ink-muted shrink-0" />
              <span className="font-ui text-xs font-semibold text-ink-muted">Empate · {result.rounds} rondas</span>
            </div>
          )}
          {result?.delivered === true && (
            <span className="font-body text-xs text-forest">Recursos entregados</span>
          )}
          {result?.delivered === false && (
            <span className="font-body text-xs text-ink-muted">{result.reason ?? 'No entregado'}</span>
          )}
          {result?.type === 'spy' && (
            <span className="font-body text-xs text-ink-muted">{result.message}</span>
          )}
        </div>
      )}

      {/* Transport resources */}
      {mission.missionType === 'transport' && (mission.resources.wood + mission.resources.stone + mission.resources.grain) > 0 && (
        <div className="flex items-center gap-3 text-xs text-ink-muted flex-wrap">
          <Package size={11} className="shrink-0" />
          {mission.resources.wood  > 0 && <span>🪵 {formatResource(mission.resources.wood)}</span>}
          {mission.resources.stone > 0 && <span>🪨 {formatResource(mission.resources.stone)}</span>}
          {mission.resources.grain > 0 && <span>🌾 {formatResource(mission.resources.grain)}</span>}
        </div>
      )}

      {/* Recall button — only for active outbound missions */}
      {!isReturning && (
        <button
          onClick={() => recall.mutate(mission.id)}
          disabled={recall.isPending}
          className="flex items-center gap-1.5 text-xs font-ui text-ink-muted/60 hover:text-ink-muted transition-colors disabled:opacity-40"
          title="Retirar misión"
        >
          {recall.isPending
            ? <Loader2 size={10} className="animate-spin" />
            : <Undo2 size={10} />
          }
          Retirar
        </button>
      )}
    </Card>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function MissionsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(2)].map((_, i) => (
        <Card key={i} className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-2.5 w-48" />
            </div>
            <div className="skeleton h-4 w-16" />
          </div>
        </Card>
      ))}
    </div>
  )
}
