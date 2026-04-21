import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Shield, Loader2, Plus, Rocket } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Sheet } from '@/components/ui/Sheet'
import { useArmies, useSendArmy, type MissionType } from '@/features/armies/useArmies'
import { useKingdom, type Kingdom } from '@/features/kingdom/useKingdom'
import { useResearch } from '@/features/research/useResearch'
import { ALL_UNIT_META, MISSION_META } from './armiesMeta'
import { MissionRow } from './components/MissionRow'
import { CoordPicker } from './components/CoordPicker'

export function ArmiesPage() {
  const qc = useQueryClient()
  const { data: armies, isLoading } = useArmies()
  const { data: kingdom } = useKingdom()
  const { data: researchData } = useResearch()
  const send = useSendArmy()
  const [searchParams, setSearchParams] = useSearchParams()

  const initRealm  = Math.max(1, parseInt(searchParams.get('realm')  ?? '1', 10) || 1)
  const initRegion = Math.max(1, parseInt(searchParams.get('region') ?? '1', 10) || 1)
  const initSlot   = Math.max(1, parseInt(searchParams.get('slot')   ?? '1', 10) || 1)
  const initType   = (searchParams.get('type') ?? 'attack') as MissionType

  const [sheetOpen, setSheetOpen] = useState(() => searchParams.get('type') !== null)
  const [missionType, setMissionType] = useState<MissionType>(initType)
  const [tRealm,  setTRealm]  = useState(initRealm)
  const [tRegion, setTRegion] = useState(initRegion)
  const [tSlot,   setTSlot]   = useState(initSlot)
  const [units,        setUnits]        = useState<Record<string, number>>({})
  const [resLoad,      setResLoad]      = useState({ wood: 0, stone: 0, grain: 0 })
  const [holdingHours, setHoldingHours] = useState(1)

  useEffect(() => {
    if (searchParams.get('type')) setSearchParams({}, { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleEnd = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['armies'] })
    qc.invalidateQueries({ queryKey: ['kingdom'] })
    qc.invalidateQueries({ queryKey: ['barracks'] })
  }, [qc])

  const setUnit    = (id: string, val: string) => setUnits(prev => ({ ...prev, [id]: Math.max(0, parseInt(val) || 0) }))
  const isMissile  = missionType === 'missile'
  const totalUnits = Object.values(units).reduce((s, n) => s + n, 0)

  const cartographyLevel = researchData?.research.find(r => r.id === 'cartography')?.level ?? 0
  const maxExpeditions = Math.max(1, Math.floor(Math.sqrt(cartographyLevel)))
  const activeExpeditions = armies?.missions.filter(
    m => m.missionType === 'expedition' && m.state !== 'completed'
  ).length ?? 0
  const expeditionSlotsFull = activeExpeditions >= maxExpeditions

  const canSend    = totalUnits > 0 && !send.isPending && !(missionType === 'expedition' && expeditionSlotsFull)
  const hasUnits   = ALL_UNIT_META.some(u => ((kingdom as unknown as Record<string, number> | null)?.[u.id] ?? 0) > 0)

  const handleSend = () => {
    const destSlot = missionType === 'expedition' ? 16 : tSlot
    send.mutate(
      {
        missionType,
        target: { realm: tRealm, region: tRegion, slot: destSlot },
        units,
        resources: (missionType === 'transport' || missionType === 'deploy') ? resLoad : undefined,
        holdingHours: missionType === 'expedition' ? holdingHours : undefined,
      },
      {
        onSuccess: () => {
          setUnits({})
          setResLoad({ wood: 0, stone: 0, grain: 0 })
          setHoldingHours(1)
          setSheetOpen(false)
        },
      }
    )
  }

  const activeMissions    = armies?.missions.filter(m => m.state === 'active')    ?? []
  const returningMissions = armies?.missions.filter(m => m.state === 'returning') ?? []
  const totalMissions     = activeMissions.length + returningMissions.length

  return (
    <div className="space-y-6">
      <div className="anim-fade-up flex items-start justify-between gap-4">
        <div>
          <span className="section-heading">Ejército</span>
          <h1 className="page-title mt-0.5">Misiones</h1>
          <p className="font-body text-ink-muted text-sm mt-1.5">Gestiona tus ejércitos en campaña.</p>
        </div>
        <Button variant="primary" size="sm" className="mt-1 shrink-0" onClick={() => setSheetOpen(true)}>
          <Plus size={13} />
          Enviar misión
        </Button>
      </div>

      <div className="anim-fade-up-1 space-y-3">
        {isLoading ? (
          <MissionsSkeleton />
        ) : totalMissions === 0 ? (
          <Card className="p-10 text-center">
            <Shield size={28} className="text-ink-muted/25 mx-auto mb-3" />
            <p className="font-body text-sm text-ink-muted/50">No hay misiones en curso</p>
          </Card>
        ) : (
          <>
            {activeMissions.length > 0 && (
              <div className="space-y-3">
                <p className="section-heading">En curso ({activeMissions.length})</p>
                {activeMissions.map(m => <MissionRow key={m.id} mission={m} onEnd={handleEnd} />)}
              </div>
            )}
            {returningMissions.length > 0 && (
              <div className="space-y-3">
                <p className="section-heading">Retornando ({returningMissions.length})</p>
                {returningMissions.map(m => <MissionRow key={m.id} mission={m} onEnd={handleEnd} />)}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Enviar misión" maxWidth="max-w-lg">
        <MissionForm
          missionType={missionType} setMissionType={setMissionType}
          tRealm={tRealm} setTRealm={setTRealm}
          tRegion={tRegion} setTRegion={setTRegion}
          tSlot={tSlot} setTSlot={setTSlot}
          units={units} setUnit={setUnit}
          resLoad={resLoad} setResLoad={setResLoad}
          holdingHours={holdingHours} setHoldingHours={setHoldingHours}
          isMissile={isMissile} totalUnits={totalUnits}
          canSend={canSend} hasUnits={hasUnits}
          kingdom={kingdom} send={send}
          onSend={handleSend}
          expeditionSlotsFull={expeditionSlotsFull}
          activeExpeditions={activeExpeditions}
          maxExpeditions={maxExpeditions}
          cartographyLevel={cartographyLevel}
        />
      </Sheet>
    </div>
  )
}

// ── Mission form (sheet content) ──────────────────────────────────────────────

function MissionForm({
  missionType, setMissionType,
  tRealm, setTRealm, tRegion, setTRegion, tSlot, setTSlot,
  units, setUnit, resLoad, setResLoad,
  holdingHours, setHoldingHours,
  isMissile, totalUnits, canSend, hasUnits, kingdom, send, onSend,
  expeditionSlotsFull, activeExpeditions, maxExpeditions, cartographyLevel,
}: {
  missionType: MissionType; setMissionType: (t: MissionType) => void
  tRealm: number; setTRealm: (n: number) => void
  tRegion: number; setTRegion: (n: number) => void
  tSlot: number; setTSlot: (n: number) => void
  units: Record<string, number>; setUnit: (id: string, val: string) => void
  resLoad: { wood: number; stone: number; grain: number }
  setResLoad: React.Dispatch<React.SetStateAction<{ wood: number; stone: number; grain: number }>>
  holdingHours: number; setHoldingHours: (n: number) => void
  isMissile: boolean; totalUnits: number; canSend: boolean; hasUnits: boolean
  kingdom: Kingdom | null | undefined; send: ReturnType<typeof useSendArmy>; onSend: () => void
  expeditionSlotsFull: boolean; activeExpeditions: number; maxExpeditions: number; cartographyLevel: number
}) {
  const kingdomUnits = kingdom as unknown as Record<string, number> | null | undefined
  return (
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
        <p className="font-body text-xs text-ink-muted/70 italic">{MISSION_META[missionType].desc}</p>
      </div>

      <div className="divider">◆</div>

      {/* Destination */}
      <div className="space-y-2">
        <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Destino</p>
        {missionType === 'expedition' ? (
          <div className="space-y-3 py-1">
            <p className="font-body text-xs text-gold/80 italic">
              Las expediciones se dirigen automáticamente a las <strong>Tierras Ignotas</strong> (slot 16).
            </p>
            <p className={`font-ui text-xs ${expeditionSlotsFull ? 'text-crimson' : 'text-ink-muted'}`}>
              Expediciones activas: {activeExpeditions}/{maxExpeditions}
              {cartographyLevel === 0 && ' · Mejora Cartografía para desbloquear más slots'}
            </p>
            <div className="space-y-1.5">
              <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Duración en destino</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1} max={Math.max(1, cartographyLevel)}
                  value={holdingHours}
                  onChange={e => setHoldingHours(parseInt(e.target.value, 10))}
                  className="flex-1 accent-gold-dim"
                />
                <span className="font-ui text-sm font-semibold text-ink-mid tabular-nums w-16 text-right">
                  {holdingHours}h
                </span>
              </div>
              <p className="font-body text-[0.65rem] text-ink-muted/60">
                Entre 1 y {Math.max(1, cartographyLevel)} hora(s) · nivel de Cartografía
              </p>
            </div>
          </div>
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
            <p className="font-ui text-xs text-ink-muted uppercase tracking-wider">Bombas a lanzar</p>
            {(kingdom?.ballistic ?? 0) === 0 ? (
              <p className="font-body text-xs text-ink-muted/50 italic py-3 text-center">
                No tienes Bombas Alquímicas. Fábricalas en el Cuartel → Combate.
              </p>
            ) : (
              <div className="flex items-center gap-2">
                <Rocket size={14} className="text-crimson shrink-0" />
                <span className="font-ui text-xs text-ink flex-1">Bomba Alquímica</span>
                <span className="font-ui text-xs text-ink-muted tabular-nums shrink-0">
                  {(kingdom?.ballistic ?? 0).toLocaleString()} disponibles
                </span>
                <input
                  type="number" min={0} max={kingdom?.ballistic ?? 0}
                  value={units['ballistic'] || ''}
                  placeholder="0"
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
                  const available = kingdomUnits?.[u.id] ?? 0
                  if (available === 0) return null
                  return (
                    <div key={u.id} className="flex items-center gap-2">
                      <u.Icon size={14} className="text-gold-dim shrink-0" />
                      <span className="font-ui text-xs text-ink flex-1 min-w-0 truncate">{u.name}</span>
                      <span className="font-ui text-xs text-ink-muted tabular-nums shrink-0">{available.toLocaleString()}</span>
                      <input
                        type="number" min={0} max={available}
                        value={units[u.id] || ''}
                        placeholder="0"
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
              {(['wood', 'stone', 'grain'] as const).map(key => {
                const labels = { wood: ['🪵', 'Madera'], stone: ['🪨', 'Piedra'], grain: ['🌾', 'Grano'] }
                const [emoji, label] = labels[key]
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-base w-5 text-center">{emoji}</span>
                    <span className="font-ui text-xs text-ink flex-1">{label}</span>
                    <input
                      type="number" min={0} value={resLoad[key] || ''}
                      placeholder="0"
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
          {(send.error as Error | null)?.message ?? 'Error al enviar la misión'}
        </p>
      )}

      <Button variant="primary" className="w-full" disabled={!canSend} onClick={onSend}>
        {send.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
        {send.isPending ? 'Enviando…' : `Enviar ${MISSION_META[missionType].label}`}
      </Button>
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
