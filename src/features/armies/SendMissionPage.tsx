import { useState, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Loader2, Rocket, Minus, Plus } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useArmies, useSendArmy, type MissionType } from '@/features/armies/useArmies'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResearch } from '@/features/research/useResearch'
import { ALL_UNIT_META, MISSION_META } from './armiesMeta'
import { CoordPicker } from './components/CoordPicker'
import { calcDistance, calcDuration } from '@/lib/game/speed'
import { formatDuration } from '@/lib/format'
import type { IconType } from 'react-icons'

// Units visible per mission type (undefined = all units)
const MISSION_UNITS: Partial<Record<MissionType, string[]>> = {
  spy:      ['scout'],
  scavenge: ['scavenger'],
  colonize: ['colonist'],
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

  const cartographyLevel  = researchData?.research.find(r => r.id === 'cartography')?.level ?? 0
  const maxExpeditions    = Math.max(1, Math.floor(Math.sqrt(cartographyLevel)))
  const activeExpeditions = armies?.missions.filter(
    m => m.missionType === 'expedition' && m.state !== 'completed'
  ).length ?? 0
  const expeditionSlotsFull = activeExpeditions >= maxExpeditions

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

  const travelPreview = useMemo(() => {
    if (!kingdom) return null
    const effectiveUnits = isMissile ? { ballistic: ballisticCount || 1 } : units
    if (!isMissile && totalUnits === 0) return null
    if (isMissile && ballisticCount === 0) return null
    const k = kingdom as unknown as Record<string, number>
    const origin = { realm: k.realm, region: k.region, slot: k.slot }
    const destSlot = missionType === 'expedition' ? 16 : tSlot
    const dest = { realm: tRealm, region: tRegion, slot: destSlot }
    const research = Object.fromEntries(researchData?.research.map(r => [r.id, r.level]) ?? [])
    const dist = calcDistance(origin, dest)
    return calcDuration(dist, effectiveUnits, speedPct, 1, research, null)
  }, [kingdom, isMissile, ballisticCount, units, totalUnits, missionType, tSlot, tRealm, tRegion, speedPct, researchData])

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
          <div className="space-y-4">
            <div className="py-3 px-4 rounded-lg bg-parchment-deep border border-gold/15">
              <p className="font-ui text-sm font-semibold text-gold-dim">Tierras Ignotas</p>
              <p className="font-body text-xs text-ink-muted mt-1">Destino automático · slot 16 del reino y región actuales</p>
            </div>
            <p className={`font-ui text-xs ${expeditionSlotsFull ? 'text-crimson font-semibold' : 'text-ink-muted'}`}>
              Expediciones activas: {activeExpeditions} / {maxExpeditions}
              {cartographyLevel === 0 && ' · Mejora Cartografía para desbloquear más slots'}
            </p>
            {cartographyLevel > 1 ? (
              <div className="space-y-2">
                <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Duración en destino</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={1} max={cartographyLevel}
                    value={holdingHours}
                    onChange={e => setHoldingHours(parseInt(e.target.value, 10))}
                    className="flex-1 accent-gold-dim"
                  />
                  <span className="font-ui text-sm font-semibold text-ink-mid tabular-nums w-12 text-right">{holdingHours}h</span>
                </div>
                <p className="font-body text-[0.65rem] text-ink-muted/60">
                  De 1 a {cartographyLevel} horas · mejora Cartografía para ampliar el tiempo máximo
                </p>
              </div>
            ) : (
              <p className="font-body text-xs text-ink-muted/70">
                Duración en destino: <strong className="text-ink-mid">1 hora</strong> · Mejora Cartografía para aumentarla
              </p>
            )}
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
            {(['wood', 'stone', 'grain'] as const).map(key => {
              const labels: Record<string, [string, string]> = {
                wood: ['🪵', 'Madera'], stone: ['🪨', 'Piedra'], grain: ['🌾', 'Grano'],
              }
              const [emoji, label] = labels[key]
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{emoji}</span>
                  <span className="font-ui text-sm text-ink flex-1">{label}</span>
                  <input
                    type="number" min={0} value={resLoad[key] || ''}
                    placeholder="0"
                    onChange={e => setResLoad(r => ({ ...r, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="game-input w-28 py-1.5 text-sm text-center tabular-nums"
                  />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Speed + ETA */}
      {!isMissile && (
        <Card className="anim-fade-up-3 p-5 space-y-3">
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
            Al 100% llegas lo antes posible. Reduce la velocidad para coordinar ataques simultáneos con otros jugadores. Al 50% tardas el doble.
          </p>
        </Card>
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
