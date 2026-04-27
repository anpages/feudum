import { useState, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Loader2, Rocket, Minus, Plus, TreePine, Mountain, Wheat } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useArmies, useSendArmy, type MissionType } from '@/features/armies/useArmies'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResearch } from '@/features/research/useResearch'
import { useResourceSettings } from '@/features/resources/useResources'
import { ALL_UNIT_META, MISSION_META } from './armiesMeta'
import { CoordPicker } from './components/CoordPicker'
import { calcDistance, calcDuration, calcCargoCapacity, calcGrainConsumption, UNIT_CAPACITY } from '@/lib/game/speed'
import { formatDuration, formatResource } from '@/lib/format'
import type { IconType } from 'react-icons'

const UNIT_TIERS = [
  ['squire', 'knight'],
  ['paladin', 'warlord'],
  ['grandKnight', 'siegeMaster'],
  ['warMachine', 'dragonKnight'],
]
const UNIT_TIER_LABELS = ['Escudero/Caballero', 'Paladín/Señor', 'Gran Caballero/Maestro Asedio', 'Máquina/Caballero Dragón']

function maxResourcesByPoints(pts: number) {
  if      (pts <     10000) return   40000
  else if (pts <    100000) return  500000
  else if (pts <   1000000) return 1200000
  else if (pts <   5000000) return 1800000
  else if (pts <  25000000) return 2400000
  else if (pts <  50000000) return 3000000
  else if (pts <  75000000) return 3600000
  else if (pts < 100000000) return 4200000
  else                      return 5000000
}

function expeditionUnitTier(units: Record<string, number>): number {
  const COMBAT = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight']
  const sentTiers = COMBAT.filter(k => (units[k] ?? 0) > 0)
    .map(k => UNIT_TIERS.findIndex(t => t.includes(k)))
    .filter(t => t >= 0)
  if (sentTiers.length === 0) return 0
  return Math.min(Math.max(...sentTiers) + 1, UNIT_TIERS.length - 1)
}

// Units visible per mission type (undefined = all units)
const ALL_COMBAT_UNITS = ['squire','knight','paladin','warlord','grandKnight','siegeMaster','warMachine','dragonKnight','merchant','caravan','colonist','scavenger']

const MISSION_UNITS: Partial<Record<MissionType, string[]>> = {
  spy:      ['scout'],
  scavenge: ['scavenger'],
  colonize: ALL_COMBAT_UNITS,
  attack:    ALL_COMBAT_UNITS,
  transport: ALL_COMBAT_UNITS,
}

function parseError(err: unknown): string {
  const msg = (err as Error)?.message ?? 'Error al enviar la misión'
  try {
    const parsed = JSON.parse(msg)
    return parsed.error ?? parsed.message ?? msg
  } catch {
    return msg
  }
}

// ── Unit stepper row ──────────────────────────────────────────────────────────

function UnitRow({
  id, name, Icon, available, value, onChange,
}: {
  id: string; name: string; Icon: IconType
  available: number; value: number; onChange: (id: string, v: number) => void
}) {
  const inc = (d: number) => onChange(id, Math.max(0, Math.min(available, value + d)))
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-gold-soft border border-gold/15 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-gold-dim" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm text-ink font-medium truncate">{name}</p>
        <p className="font-ui text-[0.65rem] text-ink-muted tabular-nums">{available.toLocaleString()} disponibles</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => inc(-10)} className="hidden sm:flex px-1.5 h-8 items-center justify-center rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm text-[0.62rem] font-ui transition-colors">−10</button>
        <button onClick={() => inc(-1)} className="w-8 h-8 flex items-center justify-center rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm transition-colors">
          <Minus size={12} />
        </button>
        <span className={`w-10 text-center font-ui text-sm tabular-nums font-semibold ${value > 0 ? 'text-gold-dim' : 'text-ink-muted/30'}`}>
          {value > 0 ? value.toLocaleString() : '–'}
        </span>
        <button onClick={() => inc(1)} className="w-8 h-8 flex items-center justify-center rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm transition-colors">
          <Plus size={12} />
        </button>
        <button onClick={() => inc(10)} className="hidden sm:flex px-1.5 h-8 items-center justify-center rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm text-[0.62rem] font-ui transition-colors">+10</button>
        <button
          onClick={() => onChange(id, available)}
          className="w-10 h-8 flex items-center justify-center rounded border border-gold/20 text-ink-muted hover:bg-gold-soft hover:text-gold-dim text-[0.6rem] font-ui font-semibold transition-colors"
        >
          MAX
        </button>
      </div>
    </div>
  )
}

// ── SendMissionPage ───────────────────────────────────────────────────────────

export function SendMissionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const initRealm  = Math.max(1, parseInt(searchParams.get('realm')  ?? '1', 10) || 1)
  const initRegion = Math.max(1, parseInt(searchParams.get('region') ?? '1', 10) || 1)
  const initSlot   = Math.max(1, parseInt(searchParams.get('slot')   ?? '1', 10) || 1)
  const initType   = (searchParams.get('type') ?? 'attack') as MissionType

  const { data: kingdom } = useKingdom()
  const { data: researchData } = useResearch()
  const { data: armies } = useArmies()
  const { data: serverSettings } = useResourceSettings()
  const send = useSendArmy()

  const [missionType, setMissionType] = useState<MissionType>(initType)
  const [tRealm,  setTRealm]  = useState(initRealm)
  const [tRegion, setTRegion] = useState(initRegion)
  const [tSlot,   setTSlot]   = useState(initSlot)
  const [units,   setUnitsMap] = useState<Record<string, number>>({})
  const [resLoad, setResLoad]  = useState({ wood: 0, stone: 0, grain: 0 })
  const [holdingHours, setHoldingHours] = useState(1)
  const [speedPct, setSpeedPct] = useState(100)

  const kingdomRaw = kingdom as unknown as Record<string, number> | null | undefined

  // Expedition context
  const top1Points     = armies?.top1Points ?? 0
  const characterClass = armies?.characterClass ?? null
  const isDiscoverer   = characterClass === 'discoverer'

  const cartographyLevel  = researchData?.research.find(r => r.id === 'cartography')?.level ?? 0
  const maxHoldingHours   = Math.max(1, cartographyLevel)

  // Clamp holdingHours if cartography level drops below current selection
  useEffect(() => {
    if (holdingHours > maxHoldingHours) setHoldingHours(maxHoldingHours)
    if (holdingHours < 1) setHoldingHours(1)
  }, [maxHoldingHours, holdingHours])

  const maxExpeditions    = Math.max(1, Math.floor(Math.sqrt(cartographyLevel))) + (isDiscoverer ? 2 : 0)
  const activeExpeditions = armies?.missions.filter(
    m => m.missionType === 'expedition' && m.state !== 'completed'
  ).length ?? 0
  const expeditionSlotsFull = activeExpeditions >= maxExpeditions
  const cargo          = useMemo(() => calcCargoCapacity(units, characterClass), [units, characterClass])
  const hasCargo       = Object.keys(UNIT_CAPACITY).some(k => (units[k] ?? 0) > 0)
  const maxResources   = maxResourcesByPoints(top1Points)
  const effectiveMax   = isDiscoverer ? Math.floor(maxResources * 1.5) : maxResources
  const resourceCap    = hasCargo ? Math.min(cargo, effectiveMax) : effectiveMax
  const unitTierIdx    = useMemo(() => expeditionUnitTier(units), [units])

  const isMissile = missionType === 'missile'

  const unitsToShow = useMemo(() => {
    if (isMissile) return []
    const allowed = MISSION_UNITS[missionType]
    if (!allowed) return ALL_UNIT_META
    return ALL_UNIT_META.filter(u => allowed.includes(u.id))
  }, [missionType, isMissile])

  const setUnit = useCallback((id: string, val: number) => {
    setUnitsMap(prev => ({ ...prev, [id]: val }))
  }, [])

  const handleTypeChange = (t: MissionType) => {
    setMissionType(t)
    setUnitsMap({})
  }

  const totalUnits = Object.values(units).reduce((s, n) => s + n, 0)
  const ballisticCount = units['ballistic'] ?? 0

  const isWarMission = missionType === 'attack' || missionType === 'missile'
  const universeSpeed = isWarMission
    ? (serverSettings?.fleetSpeedWar     ?? 1)
    : (serverSettings?.fleetSpeedPeaceful ?? 1)

  const { travelPreview, grainPreview } = useMemo(() => {
    if (!kingdom) return { travelPreview: null, grainPreview: 0 }
    const effectiveUnits = isMissile ? { ballistic: ballisticCount || 1 } : units
    if (!isMissile && totalUnits === 0) return { travelPreview: null, grainPreview: 0 }
    if (isMissile && ballisticCount === 0) return { travelPreview: null, grainPreview: 0 }
    const k = kingdom as unknown as Record<string, number>
    const origin = { realm: k.realm, region: k.region, slot: k.slot }
    const expeditionSlot = (serverSettings as unknown as { universe_slots?: number })?.universe_slots
      ? Math.round((serverSettings as unknown as { universe_slots: number }).universe_slots) + 1
      : 16
    const destSlot = missionType === 'expedition' ? expeditionSlot : tSlot
    const dest = { realm: tRealm, region: tRegion, slot: destSlot }
    const research = Object.fromEntries(researchData?.research.map(r => [r.id, r.level]) ?? [])
    const dist = calcDistance(origin, dest)
    const secs = calcDuration(dist, effectiveUnits, speedPct, universeSpeed, research, characterClass)
    const grain = isMissile ? 0 : calcGrainConsumption(
      effectiveUnits, dist, secs, universeSpeed, research, characterClass,
      missionType === 'expedition' ? holdingHours : 0,
    )
    return { travelPreview: secs, grainPreview: grain }
  }, [kingdom, isMissile, ballisticCount, units, totalUnits, missionType, tSlot, tRealm, tRegion, speedPct, researchData, universeSpeed, characterClass, holdingHours, serverSettings])

  const canSend = !send.isPending &&
    !(missionType === 'expedition' && expeditionSlotsFull) &&
    (isMissile ? ballisticCount > 0 : totalUnits > 0)

  const handleSend = () => {
    const destSlot = missionType === 'expedition' ? 16 : tSlot
    send.mutate(
      {
        missionType,
        target: { realm: tRealm, region: tRegion, slot: destSlot },
        units,
        resources: (missionType === 'transport' || missionType === 'deploy') ? resLoad : undefined,
        holdingHours: missionType === 'expedition' ? holdingHours : undefined,
        speedPct,
      },
      { onSuccess: () => navigate('/armies') },
    )
  }

  const MissionIcon = MISSION_META[missionType].Icon

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="anim-fade-up flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg border border-gold/20 text-ink-muted hover:bg-parchment-warm transition-colors shrink-0"
        >
          <ArrowLeft size={15} />
        </button>
        <div>
          <span className="section-heading">Ejército</span>
          <h1 className="page-title mt-0.5">Enviar misión</h1>
        </div>
      </div>

      {/* Mission type selector */}
      <Card className="anim-fade-up-1 p-5 space-y-4">
        <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Tipo de misión</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {(Object.entries(MISSION_META) as [MissionType, typeof MISSION_META[MissionType]][]).map(([type, meta]) => {
            const { Icon } = meta
            const active = missionType === type
            return (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                title={meta.desc}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all text-[0.62rem] font-ui font-semibold text-center leading-tight ${
                  active
                    ? 'bg-gold-soft border-gold/40 text-gold-dim shadow-sm'
                    : 'border-gold/15 text-ink-muted hover:border-gold/25 hover:bg-parchment-warm'
                }`}
              >
                <Icon size={18} className={active ? meta.color : 'text-ink-muted/50'} />
                {meta.label}
              </button>
            )
          })}
        </div>
        <p className="font-body text-xs text-ink-muted/70 italic leading-relaxed">
          {MISSION_META[missionType].desc}
        </p>
      </Card>

      {/* Destination */}
      <Card className="anim-fade-up-1 p-5 space-y-4">
        <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Destino</p>
        {missionType === 'expedition' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <CoordPicker label="Reino"   value={tRealm}  min={1} max={3}  onChange={setTRealm} />
              <CoordPicker label="Región"  value={tRegion} min={1} max={10} onChange={setTRegion} />
              <div className="flex flex-col gap-1">
                <p className="font-ui text-xs text-ink-muted/60 uppercase tracking-wider">Slot</p>
                <div className="h-9 flex items-center px-3 rounded-lg bg-parchment-deep border border-gold/15">
                  <span className="font-ui text-sm font-bold text-gold-dim">16</span>
                  <span className="font-ui text-[0.6rem] text-ink-muted/50 ml-1.5">fijo</span>
                </div>
              </div>
            </div>
            <p className="font-ui text-xs text-ink-muted/60">
              Puedes explorar el slot 16 de cualquier región · el slot es siempre fijo en 16
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <CoordPicker label="Reino"    value={tRealm}  min={1} max={3}  onChange={setTRealm} />
            <CoordPicker label="Región"   value={tRegion} min={1} max={10} onChange={setTRegion} />
            <CoordPicker label="Posición" value={tSlot}   min={1} max={15} onChange={setTSlot} />
          </div>
        )}
      </Card>

      {/* Units */}
      <Card className="anim-fade-up-2 p-5 space-y-3">
        {isMissile ? (
          <>
            <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Bombas a lanzar</p>
            {(kingdomRaw?.ballistic ?? 0) === 0 ? (
              <p className="font-body text-sm text-ink-muted/50 italic py-4 text-center">
                No tienes Bombas Alquímicas. Fábricalas en Ataque → Combate.
              </p>
            ) : (
              <div className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-lg bg-gold-soft border border-gold/15 flex items-center justify-center shrink-0">
                  <Rocket size={16} className="text-crimson" />
                </div>
                <div className="flex-1">
                  <p className="font-ui text-sm text-ink font-medium">Bomba Alquímica</p>
                  <p className="font-ui text-[0.65rem] text-ink-muted tabular-nums">{(kingdomRaw?.ballistic ?? 0).toLocaleString()} disponibles</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setUnit('ballistic', Math.max(0, ballisticCount - 1))} className="w-8 h-8 flex items-center justify-center rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm transition-colors">
                    <Minus size={12} />
                  </button>
                  <span className={`w-10 text-center font-ui text-sm tabular-nums font-semibold ${ballisticCount > 0 ? 'text-gold-dim' : 'text-ink-muted/30'}`}>
                    {ballisticCount > 0 ? ballisticCount : '–'}
                  </span>
                  <button onClick={() => setUnit('ballistic', Math.min(kingdomRaw?.ballistic ?? 0, ballisticCount + 1))} className="w-8 h-8 flex items-center justify-center rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm transition-colors">
                    <Plus size={12} />
                  </button>
                  <button onClick={() => setUnit('ballistic', kingdomRaw?.ballistic ?? 0)} className="w-10 h-8 flex items-center justify-center rounded border border-gold/20 text-ink-muted hover:bg-gold-soft hover:text-gold-dim text-[0.6rem] font-ui font-semibold transition-colors">
                    MAX
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Unidades</p>
              {totalUnits > 0 && <Badge variant="gold">{totalUnits.toLocaleString()} seleccionadas</Badge>}
            </div>
            {MISSION_META[missionType].unitHint && (
              <div className="flex gap-2 px-3 py-2.5 rounded-lg bg-gold-soft border border-gold/20">
                <span className="text-gold-dim shrink-0 mt-0.5">💡</span>
                <p className="font-body text-xs text-ink-mid leading-relaxed">
                  {MISSION_META[missionType].unitHint}
                </p>
              </div>
            )}
            {unitsToShow.filter(u => (kingdomRaw?.[u.id] ?? 0) > 0).length === 0 ? (
              <p className="font-body text-sm text-ink-muted/50 italic py-4 text-center">
                {unitsToShow.length === 0
                  ? 'Ninguna unidad disponible para esta misión.'
                  : 'No tienes las unidades requeridas. Entrena en el Cuartel.'}
              </p>
            ) : (
              <div className="divide-y divide-gold/8">
                {unitsToShow.map(u => {
                  const available = kingdomRaw?.[u.id] ?? 0
                  if (available === 0) return null
                  return (
                    <UnitRow
                      key={u.id}
                      id={u.id}
                      name={u.name}
                      Icon={u.Icon}
                      available={available}
                      value={units[u.id] ?? 0}
                      onChange={setUnit}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Resources to transport */}
      {(missionType === 'transport' || missionType === 'deploy') && (
        <Card className="anim-fade-up-2 p-5 space-y-3">
          <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Recursos a transportar</p>
          <div className="space-y-3">
            {([
              { key: 'wood',  Icon: TreePine, label: 'Madera' },
              { key: 'stone', Icon: Mountain, label: 'Piedra' },
              { key: 'grain', Icon: Wheat,    label: 'Grano'  },
            ] as const).map(({ key, Icon, label }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-gold-soft border border-gold/15 flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-gold-dim" />
                </div>
                <span className="font-ui text-sm text-ink flex-1">{label}</span>
                <input
                  type="number" min={0} value={resLoad[key] || ''}
                  placeholder="0"
                  onChange={e => setResLoad(r => ({ ...r, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="game-input w-28 py-1.5 text-sm text-center tabular-nums"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Speed + ETA */}
      {!isMissile && (
        <Card className="anim-fade-up-3 p-5 space-y-4">
          {missionType === 'expedition' ? (
            <>
              {/* Expedition context panel */}
              <div className="rounded-lg bg-parchment-deep border border-gold/20 p-3 space-y-2">
                <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted font-semibold">Información de la expedición</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-body text-xs text-ink-muted">Capacidad de carga</span>
                    <span className={`font-ui text-xs font-semibold tabular-nums ${hasCargo ? 'text-ink' : 'text-ink-muted/50'}`}>
                      {hasCargo ? formatResource(cargo) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body text-xs text-ink-muted">Recursos máximos posibles</span>
                    <span className="font-ui text-xs font-semibold tabular-nums text-forest">
                      {formatResource(resourceCap)}
                      {!hasCargo && <span className="text-ink-muted/50 font-normal"> (sin cargadores)</span>}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-body text-xs text-ink-muted">Unidades encontrables</span>
                    <span className="font-ui text-xs font-semibold text-gold-dim">
                      {UNIT_TIER_LABELS[unitTierIdx]}
                    </span>
                  </div>
                  {isDiscoverer && (
                    <div className="flex items-center gap-1.5 pt-0.5 border-t border-gold/10">
                      <span className="font-body text-[0.65rem] text-forest">✦ Clase Explorador activa — +50% recursos y unidades encontrados, −50% encuentros de combate</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expedition: show total mission time prominently */}
              <div className="flex items-center justify-between">
                <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Duración de la misión</p>
                {travelPreview !== null && (
                  <span className="flex items-center gap-1.5 font-ui text-xs font-semibold text-gold-dim">
                    <Clock size={11} />
                    Total: {formatDuration(travelPreview * 2 + holdingHours * 3600)}
                  </span>
                )}
              </div>

              {/* Exploration time (primary control) */}
              <div className="space-y-2">
                <p className="font-ui text-xs text-ink-muted">Tiempo de exploración</p>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${maxHoldingHours}, 1fr)` }}>
                  {Array.from({ length: maxHoldingHours }, (_, i) => i + 1).map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHoldingHours(h)}
                      className={`py-1.5 rounded border font-ui text-xs font-semibold transition-colors ${
                        holdingHours === h
                          ? 'bg-gold/15 border-gold text-gold-dim'
                          : 'bg-parchment border-gold/20 text-ink-muted hover:border-gold/50 hover:text-ink-mid'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Speed */}
              <div className="space-y-2 border-t border-gold/10 pt-3">
                <div className="flex items-center justify-between">
                  <p className="font-ui text-xs text-ink-muted">Velocidad de marcha</p>
                  <span className="font-ui text-sm font-bold text-ink-mid tabular-nums">{speedPct}%</span>
                </div>
                <input
                  type="range" min={10} max={100} step={5}
                  value={speedPct}
                  onChange={e => setSpeedPct(parseInt(e.target.value, 10))}
                  className="w-full accent-gold-dim"
                />
                {travelPreview !== null && (
                  <p className="font-body text-[0.65rem] text-ink-muted/60">
                    Viaje {formatDuration(travelPreview)} · Exploración {holdingHours}h · Vuelta {formatDuration(travelPreview)}
                  </p>
                )}
                {grainPreview > 0 && (
                  <p className="font-ui text-[0.65rem] text-gold-dim">
                    Combustible: <span className="font-semibold tabular-nums">{formatResource(grainPreview)}</span> grano
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Velocidad de marcha</p>
                {travelPreview !== null && (
                  <span className="flex items-center gap-1.5 font-ui text-xs font-semibold text-gold-dim">
                    <Clock size={11} />
                    {formatDuration(travelPreview)} de viaje
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range" min={10} max={100} step={5}
                  value={speedPct}
                  onChange={e => setSpeedPct(parseInt(e.target.value, 10))}
                  className="flex-1 accent-gold-dim"
                />
                <span className="font-ui text-lg font-bold text-ink-mid tabular-nums w-14 text-right">
                  {speedPct}%
                </span>
              </div>
              <p className="font-body text-[0.65rem] text-ink-muted/60 leading-relaxed">
                Al 100% llegas lo antes posible. Reduce la velocidad para coordinar ataques simultáneos. Al 50% tardas el doble.
              </p>
              {grainPreview > 0 && (
                <p className="font-ui text-[0.65rem] text-gold-dim">
                  Combustible: <span className="font-semibold tabular-nums">{formatResource(grainPreview)}</span> grano
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {/* Slot indicators */}
      {armies?.fleetSlots && !isMissile && (
        <div className="anim-fade-up-3 space-y-2">
          {/* Expedition slots — only when expedition is selected */}
          {missionType === 'expedition' && (
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${
              expeditionSlotsFull ? 'border-crimson/25 bg-crimson/5' : 'border-gold/20 bg-gold-soft'
            }`}>
              <div>
                <span className="font-ui text-xs text-ink-muted">Slots de expedición</span>
                <p className="font-body text-[0.6rem] text-ink-muted/50 mt-0.5">
                  Independiente de los slots de flota · mejora Cartografía para más
                </p>
              </div>
              <span className={`font-ui text-sm font-bold tabular-nums shrink-0 ${
                expeditionSlotsFull ? 'text-crimson' : 'text-gold-dim'
              }`}>
                {activeExpeditions} / {maxExpeditions}
              </span>
            </div>
          )}

          {/* Fleet slots — always visible */}
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border ${
            armies.fleetSlots.used >= armies.fleetSlots.max
              ? 'border-crimson/25 bg-crimson/5'
              : 'border-gold/20 bg-gold-soft'
          }`}>
            <div>
              <span className="font-ui text-xs text-ink-muted">Slots de flota</span>
              {missionType === 'expedition' && (
                <p className="font-body text-[0.6rem] text-ink-muted/50 mt-0.5">
                  Para todas las misiones · mejora Logística para más
                </p>
              )}
            </div>
            <span className={`font-ui text-sm font-bold tabular-nums shrink-0 ${
              armies.fleetSlots.used >= armies.fleetSlots.max ? 'text-crimson' : 'text-gold-dim'
            }`}>
              {armies.fleetSlots.used} / {armies.fleetSlots.max}
            </span>
          </div>
        </div>
      )}

      {/* Error + Send button */}
      <div className="anim-fade-up-3 space-y-3 pb-10">
        {send.isError && (
          <div className="px-4 py-3 rounded-lg border border-crimson/25 bg-crimson/5">
            <p className="font-ui text-xs text-crimson font-semibold">
              {parseError(send.error)}
            </p>
          </div>
        )}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!canSend}
          onClick={handleSend}
        >
          {send.isPending
            ? <Loader2 size={14} className="animate-spin" />
            : <MissionIcon size={14} />
          }
          {send.isPending ? 'Enviando…' : `Enviar ${MISSION_META[missionType].label}`}
        </Button>
      </div>
    </div>
  )
}
