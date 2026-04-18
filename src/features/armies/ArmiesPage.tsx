import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Send,
  Shield,
  Swords,
  Eye,
  Package,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Skull,
  Pickaxe,
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
} from 'react-icons/gi'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useArmies, useSendArmy, type MissionType } from '@/features/armies/useArmies'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { MissionRow } from './components/MissionRow'

// ── Unit metadata ─────────────────────────────────────────────────────────────

const COMBAT_UNITS: { id: string; name: string; Icon: IconType }[] = [
  { id: 'squire', name: 'Escudero', Icon: GiLightFighter },
  { id: 'knight', name: 'Caballero', Icon: GiHeavyFighter },
  { id: 'paladin', name: 'Paladín', Icon: GiMountedKnight },
  { id: 'warlord', name: 'Señor de la Guerra', Icon: GiKnightBanner },
  { id: 'grandKnight', name: 'Gran Caballero', Icon: GiCrossedSwords },
  { id: 'siegeMaster', name: 'Maestro de Asedio', Icon: GiSiegeTower },
  { id: 'warMachine', name: 'Máquina de Guerra', Icon: GiBattleMech },
  { id: 'dragonKnight', name: 'Caballero Dragón', Icon: GiDragonHead },
]
const SUPPORT_UNITS: { id: string; name: string; Icon: IconType }[] = [
  { id: 'merchant', name: 'Mercader', Icon: GiTrade },
  { id: 'caravan', name: 'Caravana', Icon: GiCaravan },
  { id: 'colonist', name: 'Colonista', Icon: GiCampingTent },
  { id: 'scavenger', name: 'Carroñero', Icon: GiVulture },
  { id: 'scout', name: 'Explorador', Icon: GiSpyglass },
]
const ALL_UNIT_META = [...COMBAT_UNITS, ...SUPPORT_UNITS]

const MISSION_META: Record<
  MissionType,
  { label: string; Icon: typeof Swords; color: string; desc: string }
> = {
  attack: {
    label: 'Ataque',
    Icon: Swords,
    color: 'text-crimson',
    desc: 'Atacar y saquear el reino objetivo.',
  },
  pillage: {
    label: 'Pillaje',
    Icon: Skull,
    color: 'text-crimson',
    desc: 'Saqueo rápido contra NPCs. Sin batalla completa.',
  },
  transport: {
    label: 'Transporte',
    Icon: Package,
    color: 'text-forest',
    desc: 'Transportar recursos al reino objetivo.',
  },
  spy: {
    label: 'Espionaje',
    Icon: Eye,
    color: 'text-gold-dim',
    desc: 'Solo Exploradores. Recopila información.',
  },
  scavenge: {
    label: 'Recolección',
    Icon: Pickaxe,
    color: 'text-stone',
    desc: 'Envía Carroñeros a recolectar escombros de batalla.',
  },
  colonize: {
    label: 'Colonización',
    Icon: Tent,
    color: 'text-forest',
    desc: 'Envía Colonistas a fundar una nueva colonia.',
  },
  deploy: {
    label: 'Despliegue',
    Icon: Flag,
    color: 'text-gold',
    desc: 'Mover tropas a una colonia propia. Sin retorno.',
  },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ArmiesPage() {
  const qc = useQueryClient()
  const { data: armies, isLoading } = useArmies()
  const { data: kingdom } = useKingdom()
  const send = useSendArmy()
  const [searchParams] = useSearchParams()

  const initRealm = Math.max(1, parseInt(searchParams.get('realm') ?? '1', 10) || 1)
  const initRegion = Math.max(1, parseInt(searchParams.get('region') ?? '1', 10) || 1)
  const initSlot = Math.max(1, parseInt(searchParams.get('slot') ?? '1', 10) || 1)
  const initType = (searchParams.get('type') ?? 'attack') as MissionType

  const [missionType, setMissionType] = useState<MissionType>(initType)
  const [tRealm, setTRealm] = useState(initRealm)
  const [tRegion, setTRegion] = useState(initRegion)
  const [tSlot, setTSlot] = useState(initSlot)
  const [units, setUnits] = useState<Record<string, number>>({})
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
  const canSend = totalUnits > 0 && !send.isPending

  const handleSend = () => {
    send.mutate(
      {
        missionType,
        target: { realm: tRealm, region: tRegion, slot: tSlot },
        units,
        resources: missionType === 'transport' || missionType === 'deploy' ? resLoad : undefined,
      },
      {
        onSuccess: () => {
          setUnits({})
          setResLoad({ wood: 0, stone: 0, grain: 0 })
        },
      }
    )
  }

  const activeMissions = armies?.missions.filter(m => m.state === 'active') ?? []
  const returningMissions = armies?.missions.filter(m => m.state === 'returning') ?? []

  return (
    <div className="space-y-8">
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
          <h2 className="font-ui text-sm font-semibold text-ink uppercase tracking-widest">
            Enviar misión
          </h2>

          {/* Mission type selector */}
          <Card className="p-4 space-y-3">
            <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">
              Tipo de misión
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(
                Object.entries(MISSION_META) as [MissionType, (typeof MISSION_META)[MissionType]][]
              ).map(([type, meta]) => {
                const { Icon } = meta
                return (
                  <button
                    key={type}
                    onClick={() => setMissionType(type)}
                    className={`flex flex-col items-center gap-1 p-2 rounded border transition-all text-[0.65rem] font-ui font-semibold text-center leading-tight ${
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
              <CoordPicker label="Reino" value={tRealm} min={1} max={3} onChange={setTRealm} />
              <CoordPicker label="Región" value={tRegion} min={1} max={10} onChange={setTRegion} />
              <CoordPicker label="Posición" value={tSlot} min={1} max={15} onChange={setTSlot} />
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
                    <span className="font-ui text-xs text-ink flex-1 min-w-0 truncate">
                      {u.name}
                    </span>
                    <span className="font-ui text-xs text-ink-muted tabular-nums shrink-0">
                      {available.toLocaleString()}
                    </span>
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
              {!kingdom ||
                (ALL_UNIT_META.every(u => ((kingdom as any)?.[u.id] ?? 0) === 0) && (
                  <p className="font-body text-xs text-ink-muted/50 italic py-2 text-center">
                    No tienes unidades disponibles. Entrena unidades en el Cuartel.
                  </p>
                ))}
            </div>
          </Card>

          {/* Resource load (transport / deploy) */}
          {(missionType === 'transport' || missionType === 'deploy') && (
            <Card className="p-4 space-y-3">
              <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">
                Recursos a transportar
              </p>
              <div className="space-y-2">
                {(
                  [
                    ['wood', '🪵', 'Madera'],
                    ['stone', '🪨', 'Piedra'],
                    ['grain', '🌾', 'Grano'],
                  ] as const
                ).map(([key, emoji, label]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-base w-5 text-center">{emoji}</span>
                    <span className="font-ui text-xs text-ink flex-1">{label}</span>
                    <input
                      type="number"
                      min={0}
                      value={resLoad[key]}
                      onChange={e =>
                        setResLoad(r => ({
                          ...r,
                          [key]: Math.max(0, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="game-input w-28 py-1 text-sm text-center tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {send.isError && (
            <p className="font-ui text-xs text-crimson px-1">
              {(send.error as any)?.message ?? 'Error al enviar la misión'}
            </p>
          )}

          <Button variant="primary" className="w-full" disabled={!canSend} onClick={handleSend}>
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

// ── CoordPicker ───────────────────────────────────────────────────────────────

function CoordPicker({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
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
        >
          <ChevronLeft size={11} />
        </button>
        <span className="font-ui font-semibold text-ink w-6 text-center tabular-nums text-sm">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={11} />
        </button>
      </div>
    </div>
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
