import { useState, useCallback, useEffect } from 'react'
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
  Plus,
  Compass,
  Rocket,
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
import { Sheet } from '@/components/ui/Sheet'
import { useArmies, useSendArmy, type MissionType } from '@/features/armies/useArmies'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { MissionRow } from './components/MissionRow'

// ── Unit metadata ─────────────────────────────────────────────────────────────

const COMBAT_UNITS: { id: string; name: string; Icon: IconType }[] = [
  { id: 'squire',      name: 'Escudero',           Icon: GiLightFighter },
  { id: 'knight',      name: 'Caballero',           Icon: GiHeavyFighter },
  { id: 'paladin',     name: 'Paladín',             Icon: GiMountedKnight },
  { id: 'warlord',     name: 'Señor de la Guerra',  Icon: GiKnightBanner },
  { id: 'grandKnight', name: 'Gran Caballero',      Icon: GiCrossedSwords },
  { id: 'siegeMaster', name: 'Maestro de Asedio',   Icon: GiSiegeTower },
  { id: 'warMachine',  name: 'Máquina de Guerra',   Icon: GiBattleMech },
  { id: 'dragonKnight',name: 'Caballero Dragón',    Icon: GiDragonHead },
]
const SUPPORT_UNITS: { id: string; name: string; Icon: IconType }[] = [
  { id: 'merchant',  name: 'Mercader',    Icon: GiTrade },
  { id: 'caravan',   name: 'Caravana',    Icon: GiCaravan },
  { id: 'colonist',  name: 'Colonista',   Icon: GiCampingTent },
  { id: 'scavenger', name: 'Carroñero',   Icon: GiVulture },
  { id: 'scout',     name: 'Explorador',  Icon: GiSpyglass },
]
const ALL_UNIT_META = [...COMBAT_UNITS, ...SUPPORT_UNITS]

const MISSION_META: Record<MissionType, { label: string; Icon: typeof Swords; color: string; desc: string }> = {
  attack:    { label: 'Ataque',       Icon: Swords,   color: 'text-crimson',   desc: 'Atacar y saquear el reino objetivo.' },
  pillage:   { label: 'Pillaje',      Icon: Skull,    color: 'text-crimson',   desc: 'Saqueo rápido contra NPCs. Sin batalla completa.' },
  transport: { label: 'Transporte',   Icon: Package,  color: 'text-forest',    desc: 'Transportar recursos al reino objetivo.' },
  spy:       { label: 'Espionaje',    Icon: Eye,      color: 'text-gold-dim',  desc: 'Solo Exploradores. Recopila información.' },
  scavenge:  { label: 'Recolección',  Icon: Pickaxe,  color: 'text-stone',     desc: 'Envía Carroñeros a recolectar escombros.' },
  colonize:  { label: 'Colonización', Icon: Tent,     color: 'text-forest',    desc: 'Envía Colonistas a fundar una nueva colonia.' },
  deploy:    { label: 'Despliegue',   Icon: Flag,     color: 'text-gold',      desc: 'Mover tropas a una colonia propia. Sin retorno.' },
  expedition:{ label: 'Expedición',   Icon: Compass,  color: 'text-gold',      desc: 'Explora las Tierras Ignotas. Destino fijo: slot 16.' },
  missile:   { label: 'Misil',        Icon: Rocket,   color: 'text-crimson',   desc: 'Bombardeo a distancia. Solo daña defensas. Los trebuchets interceptan 1 misil cada uno.' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ArmiesPage() {
  const qc = useQueryClient()
  const { data: armies, isLoading } = useArmies()
  const { data: kingdom } = useKingdom()
  const send = useSendArmy()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sheetOpen, setSheetOpen] = useState(false)

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

  // Auto-open sheet when coming from map with URL params
  useEffect(() => {
    if (searchParams.get('type')) {
      setSheetOpen(true)
      setSearchParams({}, { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEnd = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['armies'] })
    qc.invalidateQueries({ queryKey: ['kingdom'] })
    qc.invalidateQueries({ queryKey: ['barracks'] })
  }, [qc])

  const setUnit = (id: string, val: string) => {
    const n = Math.max(0, parseInt(val) || 0)
    setUnits(prev => ({ ...prev, [id]: n }))
  }

  const isMissile  = missionType === 'missile'
  const totalUnits = Object.values(units).reduce((s, n) => s + n, 0)
  const canSend    = totalUnits > 0 && !send.isPending

  const handleSend = () => {
    const destSlot = missionType === 'expedition' ? 16 : tSlot
    send.mutate(
      {
        missionType,
        target: { realm: tRealm, region: tRegion, slot: destSlot },
        units,
        resources: missionType === 'transport' || missionType === 'deploy' ? resLoad : undefined,
      },
      {
        onSuccess: () => {
          setUnits({})
          setResLoad({ wood: 0, stone: 0, grain: 0 })
          setSheetOpen(false)
        },
      }
    )
  }

  const activeMissions    = armies?.missions.filter(m => m.state === 'active')    ?? []
  const returningMissions = armies?.missions.filter(m => m.state === 'returning') ?? []
  const totalMissions     = activeMissions.length + returningMissions.length

  const hasUnits = ALL_UNIT_META.some(u => ((kingdom as any)?.[u.id] ?? 0) > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="anim-fade-up flex items-start justify-between gap-4">
        <div>
          <span className="section-heading">Ejército</span>
          <h1 className="page-title mt-0.5">Misiones</h1>
          <p className="font-body text-ink-muted text-sm mt-1.5">
            Gestiona tus ejércitos en campaña.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="mt-1 shrink-0"
          onClick={() => setSheetOpen(true)}
        >
          <Plus size={13} />
          Enviar misión
        </Button>
      </div>

      {/* Active missions */}
      <div className="anim-fade-up-1 space-y-3">
        {isLoading ? (
          <MissionsSkeleton />
        ) : totalMissions === 0 ? (
          <Card className="p-10 text-center">
            <Shield size={28} className="text-ink-muted/25 mx-auto mb-3" />
            <p className="font-body text-sm text-ink-muted/50 mb-4">
              No hay misiones en curso
            </p>
            <Button variant="ghost" size="sm" onClick={() => setSheetOpen(true)}>
              <Send size={12} />
              Enviar primera misión
            </Button>
          </Card>
        ) : (
          <>
            {activeMissions.length > 0 && (
              <div className="space-y-3">
                <p className="section-heading">En curso ({activeMissions.length})</p>
                {activeMissions.map(m => (
                  <MissionRow key={m.id} mission={m} onEnd={handleEnd} />
                ))}
              </div>
            )}
            {returningMissions.length > 0 && (
              <div className="space-y-3">
                <p className="section-heading">Retornando ({returningMissions.length})</p>
                {returningMissions.map(m => (
                  <MissionRow key={m.id} mission={m} onEnd={handleEnd} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Send mission — Sheet */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Enviar misión"
        maxWidth="max-w-lg"
      >
        <div className="p-5 space-y-5">
          {/* Mission type */}
          <div className="space-y-2">
            <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Tipo de misión</p>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.entries(MISSION_META) as [MissionType, typeof MISSION_META[MissionType]][]).map(([type, meta]) => {
                const { Icon } = meta
                return (
                  <button
                    key={type}
                    onClick={() => setMissionType(type)}
                    className={`flex flex-col items-center gap-1 p-2 rounded border transition-all text-[0.65rem] font-ui font-semibold text-center leading-tight ${
                      missionType === type
                        ? 'bg-gold-soft border-gold/30 text-gold-dim shadow-sm'
                        : 'border-gold/10 text-ink-muted hover:border-gold/20 hover:bg-parchment-warm'
                    }`}
                  >
                    <Icon size={15} className={missionType === type ? meta.color : ''} />
                    {meta.label}
                  </button>
                )
              })}
            </div>
            <p className="font-body text-xs text-ink-muted/70 italic">
              {MISSION_META[missionType].desc}
            </p>
          </div>

          <div className="divider">◆</div>

          {/* Destination */}
          <div className="space-y-2">
            <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Destino</p>
            {missionType === 'expedition' ? (
              <p className="font-body text-xs text-gold/80 italic py-1">
                Las expediciones se dirigen automáticamente a las <strong>Tierras Ignotas</strong> (slot 16).
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <CoordPicker label="Reino"    value={tRealm}  min={1} max={3}  onChange={setTRealm} />
                <CoordPicker label="Región"   value={tRegion} min={1} max={10} onChange={setTRegion} />
                <CoordPicker label="Posición" value={tSlot}   min={1} max={15} onChange={setTSlot} />
              </div>
            )}
          </div>

          <div className="divider">◆</div>

          {/* Units / Missiles */}
          <div className="space-y-2">
            {isMissile ? (
              <>
                <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Misiles a lanzar</p>
                {((kingdom as any)?.ballistic ?? 0) === 0 ? (
                  <p className="font-body text-xs text-ink-muted/50 italic py-3 text-center">
                    No tienes misiles balísticos. Fabrípalos en el Cuartel → Misiles.
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Rocket size={14} className="text-crimson shrink-0" />
                    <span className="font-ui text-xs text-ink flex-1">Misil Balístico</span>
                    <span className="font-ui text-xs text-ink-muted tabular-nums shrink-0">
                      {((kingdom as any)?.ballistic ?? 0).toLocaleString()} disponibles
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={(kingdom as any)?.ballistic ?? 0}
                      value={units['ballistic'] ?? 0}
                      onChange={e => setUnit('ballistic', e.target.value)}
                      className="game-input w-16 py-1 text-sm text-center tabular-nums shrink-0"
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Unidades</p>
                  {totalUnits > 0 && <Badge variant="gold">{totalUnits.toLocaleString()} seleccionadas</Badge>}
                </div>
                {!hasUnits ? (
                  <p className="font-body text-xs text-ink-muted/50 italic py-3 text-center">
                    No tienes unidades disponibles. Entrena en el Cuartel.
                  </p>
                ) : (
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
                  </div>
                )}
              </>
            )}
          </div>

          {/* Resource load */}
          {(missionType === 'transport' || missionType === 'deploy') && (
            <>
              <div className="divider">◆</div>
              <div className="space-y-2">
                <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Recursos a transportar</p>
                <div className="space-y-2">
                  {(['wood', 'stone', 'grain'] as const).map((key) => {
                    const labels = { wood: ['🪵', 'Madera'], stone: ['🪨', 'Piedra'], grain: ['🌾', 'Grano'] }
                    const [emoji, label] = labels[key]
                    return (
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
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {send.isError && (
            <p className="font-ui text-xs text-crimson">
              {(send.error as any)?.message ?? 'Error al enviar la misión'}
            </p>
          )}

          <Button variant="primary" className="w-full" disabled={!canSend} onClick={handleSend}>
            {send.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {send.isPending ? 'Enviando…' : `Enviar ${MISSION_META[missionType].label}`}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

// ── CoordPicker ───────────────────────────────────────────────────────────────

function CoordPicker({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="section-heading mb-0 text-[0.58rem]">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={11} />
        </button>
        <span className="font-ui font-semibold text-ink w-6 text-center tabular-nums text-sm">{value}</span>
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
