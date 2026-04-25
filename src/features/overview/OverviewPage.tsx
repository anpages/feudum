import { type ReactNode, useState, useEffect, useRef, useCallback } from 'react'
import { Clock, TrendingUp, Hammer, FlaskConical, Swords, Shield, Zap, TreePine, Mountain, Wheat, AlertTriangle, Timer, Trophy } from 'lucide-react'
import {
  GiAnvil, GiSpellBook, GiCrossedSwords, GiDragonHead, GiLaurelCrown,
} from 'react-icons/gi'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { useResearch } from '@/features/research/useResearch'
import { useBuildings } from '@/features/buildings/useBuildings'
import { useBarracks } from '@/features/barracks/useBarracks'
import { useArmies } from '@/features/armies/useArmies'
import { useAuth } from '@/features/auth/useAuth'
import { useSeason } from '@/features/season/useSeason'
import { applyOptimisticCompletions } from '@/features/queues/applyOptimisticCompletions'
import { formatResource, formatDuration } from '@/lib/format'
import { label as unitLabel } from '@/lib/labels'
import { tempLabel } from '@/lib/terrain'
import { calcTempAvg } from '@/lib/game/buildings'
import { MISSION_META } from '@/features/armies/armiesMeta'
import type { ArmyMission } from '@/shared/types'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'

function formatSeasonTime(seconds: number): string {
  const months  = Math.floor(seconds / (30 * 86400))
  const days    = Math.floor((seconds % (30 * 86400)) / 86400)
  const hours   = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (months > 0) return `${months}M ${days}d`
  if (days   > 0) return `${days}d ${hours}h`
  if (hours  > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

const CLASS_INFO: Record<string, { emoji: string; label: string; color: string }> = {
  collector:  { emoji: '⛏️', label: 'Coleccionista', color: 'text-forest-light' },
  general:    { emoji: '⚔️', label: 'General',       color: 'text-crimson-light' },
  discoverer: { emoji: '🧭', label: 'Explorador',    color: 'text-gold'         },
}

const BUILDING_KEYS = [
  'sawmill','quarry','grainFarm','windmill','cathedral','workshop',
  'engineersGuild','barracks','granary','stonehouse','silo','academy',
  'alchemistTower','ambassadorHall','armoury',
] as const


export function OverviewPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: kingdom, isLoading } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const { data: researchData } = useResearch()
  const { data: buildingsData } = useBuildings()
  const { data: barracksData } = useBarracks()
  const { data: armiesData } = useArmies()
  const { user } = useAuth()

  const buildingCount = kingdom
    ? BUILDING_KEYS.reduce((s, k) => s + (Number((kingdom as Record<string, unknown>)[k]) > 0 ? 1 : 0), 0)
    : 0
  const buildingTotalLevels = kingdom
    ? BUILDING_KEYS.reduce((s, k) => s + (Number((kingdom as Record<string, unknown>)[k]) || 0), 0)
    : 0
  const researchCount = researchData?.research.filter(r => r.level > 0).length ?? 0
  const researchTotalLevels = researchData?.research.reduce((s, r) => s + r.level, 0) ?? 0

  const resMap = researchData ? Object.fromEntries(researchData.research.map(r => [r.id, r.level])) : {}
  const sword = resMap.swordsmanship ?? 0
  const arm   = resMap.armoury       ?? 0
  const effBonus = (base: number, lvl: number) => Math.floor(base * (1 + lvl * 0.1))

  const allBarracksUnits = [...(barracksData?.units ?? []), ...(barracksData?.support ?? []), ...(barracksData?.defenses ?? [])]
  const totalAttackPower = allBarracksUnits.reduce((s, u) => s + u.count * effBonus(u.attack, sword), 0)
  const totalShieldPower = allBarracksUnits.reduce((s, u) => s + u.count * effBonus(u.shield, arm),   0)
  const totalUnitCount   = allBarracksUnits.reduce((s, u) => s + u.count, 0)
  const activeMissions = armiesData?.missions.filter(m => m.state !== 'completed') ?? []
  const incomingHostileCount = armiesData?.incomingMissions.filter(m => m.threatLevel === 'hostile').length ?? 0
  const underAttack = armiesData?.underAttack ?? false

  const [militaryOpen, setMilitaryOpen] = useState(false)

  // Units currently away on missions (active + exploring + returning)
  const unitsInMissions: Record<string, number> = {}
  for (const m of armiesData?.missions ?? []) {
    if (!['active','exploring','returning'].includes(m.state)) continue
    for (const [id, n] of Object.entries(m.units ?? {})) {
      unitsInMissions[id] = (unitsInMissions[id] ?? 0) + (n ?? 0)
    }
  }

  const queuedBuildings = buildingsData?.buildings.filter(b => !!b.inQueue)
    .sort((a, b) => a.inQueue!.finishesAt - b.inQueue!.finishesAt) ?? []
  const queuedResearch = researchData?.research.filter(r => !!r.inQueue)
    .sort((a, b) => a.inQueue!.finishesAt - b.inQueue!.finishesAt) ?? []
  const allUnits = [...(barracksData?.units ?? []), ...(barracksData?.support ?? []), ...(barracksData?.defenses ?? [])]
  const queuedUnits = allUnits.filter(u => !!u.inQueue)
    .sort((a, b) => a.inQueue!.finishesAt - b.inQueue!.finishesAt)

  // Called when any queue item countdown reaches zero — applies optimistic
  // updates immediately and also triggers a server refetch.
  const handleQueueEnd = useCallback(() => {
    applyOptimisticCompletions(qc)
    qc.invalidateQueries({ queryKey: ['buildings'] })
    qc.invalidateQueries({ queryKey: ['research'] })
    qc.invalidateQueries({ queryKey: ['barracks'] })
    qc.invalidateQueries({ queryKey: ['kingdom'] })
  }, [qc])

  // Fallback timer: fires when the next active item finishes. Handles the case
  // where the page loads with items already past their deadline, or when items
  // finish while the tab is in the background (QueueRow onCountdownEnd won't fire).
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const now = Math.floor(Date.now() / 1000)
    const activeFinishTimes = [
      ...queuedBuildings.filter(b => !b.inQueue!.startedAt || b.inQueue!.startedAt <= now).map(b => b.inQueue!.finishesAt),
      ...queuedResearch.filter(r => !r.inQueue!.startedAt || r.inQueue!.startedAt <= now).map(r => r.inQueue!.finishesAt),
      ...queuedUnits.map(u => u.inQueue!.finishesAt),
    ]
    const next = activeFinishTimes.filter(t => t > now).sort((a, b) => a - b)[0]
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)
    if (!next) return
    const delay = (next - now) * 1000
    refetchTimerRef.current = setTimeout(handleQueueEnd, delay)
    return () => { if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current) }
  }, [queuedBuildings, queuedResearch, queuedUnits, handleQueueEnd])

  const charClass = user?.characterClass ? CLASS_INFO[user.characterClass] : null

  const { data: season } = useSeason()
  const [seasonTimeLeft, setSeasonTimeLeft] = useState(() =>
    Math.max(0, (season?.seasonEnd ?? 0) - Math.floor(Date.now() / 1000))
  )
  useEffect(() => {
    const end = season?.seasonEnd ?? 0
    if (!end) return
    const id = setInterval(() => setSeasonTimeLeft(Math.max(0, end - Math.floor(Date.now() / 1000))), 1000)
    return () => clearInterval(id)
  }, [season?.seasonEnd])

  if (isLoading) return <OverviewSkeleton />

  return (
    <div className="space-y-6">

      {/* ── Under attack banner ── */}
      {underAttack && (
        <div className="anim-fade-up rounded-xl border border-crimson/40 bg-crimson/8 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle size={16} className="text-crimson shrink-0 animate-pulse" />
            <span className="font-ui text-sm font-semibold text-crimson">
              ¡Bajo ataque! {incomingHostileCount === 1 ? '1 misión hostil' : `${incomingHostileCount} misiones hostiles`} en camino hacia tus reinos.
            </span>
          </div>
          <a href="/armies" className="font-ui text-xs text-crimson underline underline-offset-2 shrink-0">
            Ver misiones →
          </a>
        </div>
      )}

      {/* ── Kingdom identity banner ── */}
      <Card className="p-5 anim-fade-up">

        {/* Header: label + coords badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <span className="section-heading mb-0">Panel de mando</span>
          {kingdom?.realm != null && (
            <span className="font-ui text-[0.65rem] tabular-nums text-ink-muted border border-gold/20 bg-parchment-warm px-2 py-0.5 rounded shrink-0">
              {kingdom.realm}:{kingdom.region}:{kingdom.slot}
            </span>
          )}
        </div>

        {/* Kingdom name */}
        <h1 className="font-display text-2xl text-ink leading-tight">
          {kingdom?.name ?? '—'}
        </h1>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mt-4 pt-4 border-t border-gold/10">

          {/* Clima */}
          {(() => {
            const kk = kingdom as Record<string, unknown>
            const tempAvg = kingdom?.tempMax != null
              ? calcTempAvg(kk.tempMin as number, kk.tempMax as number)
              : null
            return (
              <div>
                <p className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted/60 mb-1">Clima</p>
                <p className="font-ui text-xs text-ink-mid">
                  {tempAvg !== null ? `🌡️ ${tempLabel(tempAvg)}` : '—'}
                </p>
              </div>
            )
          })()}

          {/* Clase */}
          <div>
            <p className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted/60 mb-1">Clase</p>
            {charClass ? (
              <p className={`font-ui text-xs font-semibold ${charClass.color}`}>
                {charClass.emoji} {charClass.label}
              </p>
            ) : (
              <button
                onClick={() => navigate('/profile')}
                className="font-ui text-xs text-gold/70 hover:text-gold transition-colors"
              >
                Elegir →
              </button>
            )}
          </div>

          {/* Temporada */}
          <div>
            <p className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted/60 mb-1">Temporada</p>
            {season?.seasonNumber ? (() => {
              const ended = season.seasonState === 'ended'
              return (
                <p className={`font-ui text-xs font-semibold flex items-center gap-1 ${ended ? 'text-gold' : 'text-crimson-light'}`}>
                  {ended ? <GiLaurelCrown size={11} /> : <GiDragonHead size={11} />}
                  T{season.seasonNumber} — {ended ? 'Finalizada' : 'En curso'}
                </p>
              )
            })() : <p className="font-ui text-xs text-ink-muted/40">—</p>}
          </div>

          {/* Tiempo / Ganador */}
          <div>
            <p className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted/60 mb-1">
              {season?.seasonState === 'ended' ? 'Ganador' : 'Tiempo restante'}
            </p>
            {season?.seasonState === 'ended' && season.winner ? (
              <p className="font-ui text-xs font-semibold text-gold flex items-center gap-1">
                <Trophy size={11} />{season.winner.username}
              </p>
            ) : seasonTimeLeft > 0 ? (
              <p className="font-ui text-xs text-ink-mid flex items-center gap-1">
                <Timer size={11} />{formatSeasonTime(seasonTimeLeft)}
              </p>
            ) : (
              <p className="font-ui text-xs text-ink-muted/40">—</p>
            )}
          </div>

        </div>
      </Card>

      {/* ── Production rates ── */}
      <section className="anim-fade-up-1">
        {(() => {
          const kk = kingdom as Record<string, unknown> | null | undefined
          const prod = (kk?.energyProduced as number | undefined) ?? 0
          const cons = (kk?.energyConsumed as number | undefined) ?? 0
          const deficit = cons > 0 && prod < cons
          const factor  = cons > 0 ? Math.min(1, prod / cons) : 1
          return (
            <>
              <div className="flex items-center justify-between mb-3.5">
                <span className="section-heading mb-0">Producción por hora</span>
                {deficit && (
                  <span className="flex items-center gap-1 font-ui text-[0.6rem] text-crimson font-semibold uppercase tracking-wide">
                    <Zap size={9} />
                    Energía al {Math.round(factor * 100)}% — producción reducida
                  </span>
                )}
              </div>
              {(() => {
                const kk2 = kingdom as Record<string, unknown> | null
                const tMin = kk2?.tempMin as number | null | undefined
                const tMax = kk2?.tempMax as number | null | undefined
                const tempFactor = tMax != null
                  ? Math.max(0.1, 1.44 - 0.004 * calcTempAvg(tMin, tMax))
                  : undefined
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <ProductionRow icon={<TreePine size={14} />} label="Madera" rate={kingdom?.woodProduction ?? 0}  current={resources.wood}  cap={kingdom?.woodCapacity}  deficit={deficit} />
                    <ProductionRow icon={<Mountain size={14} />} label="Piedra" rate={kingdom?.stoneProduction ?? 0} current={resources.stone} cap={kingdom?.stoneCapacity} deficit={deficit} />
                    <ProductionRow icon={<Wheat size={14} />}    label="Grano"  rate={kingdom?.grainProduction ?? 0} current={resources.grain} cap={kingdom?.grainCapacity} deficit={deficit} tempFactor={tempFactor} />
                  </div>
                )
              })()}
            </>
          )
        })()}
      </section>

      {/* ── Estado ── */}
      <section className="anim-fade-up-2">
        <span className="section-heading">Estado</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Kingdom stats */}
          <Card className="p-4">
            <span className="section-heading">Desarrollo</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/buildings')}
                className="flex flex-col items-center text-center p-3 rounded-lg border border-gold/15 hover:border-gold/30 hover:bg-gold/5 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-parchment-warm border border-gold/20 flex items-center justify-center mb-2.5">
                  <GiAnvil size={17} className="text-gold-dim" />
                </div>
                <span className="font-ui text-2xl font-bold text-ink tabular-nums leading-none">{buildingCount}</span>
                <span className="font-ui text-[0.58rem] text-ink-muted/60 uppercase tracking-wide mt-1">Edificios</span>
                <span className="font-body text-[0.58rem] text-ink-muted/40 mt-0.5">Nv. total {buildingTotalLevels}</span>
              </button>
              <button
                onClick={() => navigate('/research')}
                className="flex flex-col items-center text-center p-3 rounded-lg border border-gold/15 hover:border-gold/30 hover:bg-gold/5 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-parchment-warm border border-gold/20 flex items-center justify-center mb-2.5">
                  <GiSpellBook size={17} className="text-gold-dim" />
                </div>
                <span className="font-ui text-2xl font-bold text-ink tabular-nums leading-none">{researchCount}</span>
                <span className="font-ui text-[0.58rem] text-ink-muted/60 uppercase tracking-wide mt-1">Investigaciones</span>
                <span className="font-body text-[0.58rem] text-ink-muted/40 mt-0.5">Nv. total {researchTotalLevels}</span>
              </button>
            </div>
          </Card>

          {/* Military stats */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="section-heading mb-0">Fuerza militar</span>
              <button
                onClick={() => setMilitaryOpen(true)}
                className="font-ui text-[0.6rem] text-ink-muted/50 hover:text-ink-muted tabular-nums transition-colors"
              >
                {totalUnitCount} unidades →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                onClick={() => setMilitaryOpen(true)}
                className="flex flex-col items-center text-center p-3 rounded-lg border border-crimson/15 hover:border-crimson/30 hover:bg-crimson/5 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-crimson/8 border border-crimson/20 flex items-center justify-center mb-2.5">
                  <GiCrossedSwords size={17} className="text-crimson" />
                </div>
                <span className="font-ui text-xl font-bold text-ink tabular-nums leading-none">{formatResource(totalAttackPower)}</span>
                <span className="font-ui text-[0.58rem] text-ink-muted/60 uppercase tracking-wide mt-1">Ofensiva</span>
              </button>
              <button
                onClick={() => setMilitaryOpen(true)}
                className="flex flex-col items-center text-center p-3 rounded-lg border border-forest/15 hover:border-forest/30 hover:bg-forest/5 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-forest/8 border border-forest/20 flex items-center justify-center mb-2.5">
                  <Shield size={17} className="text-forest-light" />
                </div>
                <span className="font-ui text-xl font-bold text-ink tabular-nums leading-none">{formatResource(totalShieldPower)}</span>
                <span className="font-ui text-[0.58rem] text-ink-muted/60 uppercase tracking-wide mt-1">Defensiva</span>
              </button>
            </div>
          </Card>

        </div>
      </section>

      {/* ── Misiones activas ── */}
      {activeMissions.length > 0 && (
        <section className="anim-fade-up-2">
          <span className="section-heading">Misiones en marcha</span>
          <Card className="px-4 py-1">
            {activeMissions.map(m => (
              <MiniMissionRow key={m.id} mission={m} onClick={() => navigate('/armies')} />
            ))}
          </Card>
        </section>
      )}

      {/* ── Buildings queue ── */}
      <section className="anim-fade-up-3">
        <span className="section-heading">Instalaciones en progreso</span>
        {queuedBuildings.length > 0 ? (
          <div className="space-y-2">
            {queuedBuildings.map(b => (
              <QueueRow
                key={b.id}
                icon={<Hammer size={13} />}
                label={`${unitLabel(b.id)} → Nv. ${b.inQueue!.level}`}
                finishesAt={b.inQueue!.finishesAt}
                startedAt={b.inQueue!.startedAt}
                color="gold"
                onCountdownEnd={handleQueueEnd}
              />
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <div className="flex items-center gap-3 text-ink-muted/50">
              <Clock size={14} />
              <span className="font-body text-sm">Sin construcciones activas</span>
            </div>
          </Card>
        )}
      </section>

      {/* ── Research queue ── */}
      <section className="anim-fade-up-4">
        <span className="section-heading">Investigaciones en progreso</span>
        {queuedResearch.length > 0 ? (
          <div className="space-y-2">
            {queuedResearch.map(r => (
              <QueueRow
                key={r.id}
                icon={<FlaskConical size={13} />}
                label={`${unitLabel(r.id)} → Nv. ${r.inQueue!.level}`}
                finishesAt={r.inQueue!.finishesAt}
                startedAt={r.inQueue!.startedAt}
                color="forest"
                onCountdownEnd={handleQueueEnd}
              />
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <div className="flex items-center gap-3 text-ink-muted/50">
              <FlaskConical size={14} />
              <span className="font-body text-sm">Sin investigaciones activas</span>
            </div>
          </Card>
        )}
      </section>

      {/* ── Troops queue ── */}
      <section className="anim-fade-up-5">
        <span className="section-heading">Tropas en entrenamiento</span>
        {queuedUnits.length > 0 ? (
          <div className="space-y-2">
            {queuedUnits.map(u => (
              <QueueRow
                key={u.id}
                icon={<Swords size={13} />}
                label={`${unitLabel(u.id)} × ${u.inQueue!.amount}`}
                finishesAt={u.inQueue!.finishesAt}
                color="stone"
                onCountdownEnd={handleQueueEnd}
              />
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <div className="flex items-center gap-3 text-ink-muted/50">
              <Swords size={14} />
              <span className="font-body text-sm">Sin tropas en entrenamiento</span>
            </div>
          </Card>
        )}
      </section>

      {/* ── Military sheet ── */}
      <Sheet open={militaryOpen} onClose={() => setMilitaryOpen(false)} title="Fuerza militar">
        <MilitarySheetContent
          units={barracksData?.units ?? []}
          support={barracksData?.support ?? []}
          defenses={barracksData?.defenses ?? []}
          inMissions={unitsInMissions}
        />
      </Sheet>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProductionRow({
  icon, label, rate, current, cap, deficit, tempFactor,
}: { icon: ReactNode; label: string; rate: number; current?: number; cap?: number; deficit?: boolean; tempFactor?: number }) {
  const pct = cap && cap > 0 ? Math.min(100, ((current ?? 0) / cap) * 100) : 0
  const full = cap !== undefined && (current ?? 0) >= cap
  const tempPct = tempFactor !== undefined ? Math.round((tempFactor - 1) * 100) : null
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-gold/50">{icon}</span>
        <span className="font-ui text-[0.6rem] font-semibold uppercase tracking-wide text-ink-muted truncate">
          {label}
        </span>
      </div>
      <p className={`font-ui text-lg tabular-nums font-semibold leading-none ${deficit ? 'text-crimson' : 'text-ink'}`}>
        {formatResource(rate)}
      </p>
      <div className="flex items-center justify-between mt-1">
        <p className={`flex items-center gap-0.5 text-[0.6rem] ${deficit ? 'text-crimson/60' : 'text-forest-light'}`}>
          <TrendingUp size={8} />
          <span>/h · neto</span>
        </p>
        {tempPct !== null && (
          <span className={`font-ui text-[0.6rem] tabular-nums font-semibold ${tempPct >= 0 ? 'text-forest' : 'text-crimson/70'}`}>
            🌡️ {tempPct >= 0 ? '+' : ''}{tempPct}%
          </span>
        )}
      </div>
      {cap !== undefined && (
        <div className="mt-2 pt-2 border-t border-gold/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="hidden sm:inline font-ui text-[0.6rem] text-ink-muted/50">Almacén</span>
            <span className={`font-ui text-[0.6rem] tabular-nums ${full ? 'text-crimson' : 'text-ink-muted/50'}`}>
              {formatResource(current ?? 0)} / {formatResource(cap)}
            </span>
          </div>
          <div className="progress-track h-1">
            <div className={`progress-fill transition-none ${full ? 'full' : ''}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </Card>
  )
}


function QueueRow({
  icon, label: lbl, finishesAt, startedAt, color, onCountdownEnd,
}: { icon: ReactNode; label: string; finishesAt: number; startedAt?: number; color: 'gold' | 'forest' | 'stone'; onCountdownEnd?: () => void }) {
  // Force a re-render every second — remaining is derived fresh each render
  // so transitions from "En cola" → active work correctly after a data refetch.
  const [, tick] = useState(0)
  const pending = startedAt !== undefined && startedAt > Math.floor(Date.now() / 1000)
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false
    if (pending) return
    const id = setInterval(() => {
      tick(n => n + 1)
      const rem = Math.max(0, finishesAt - Math.floor(Date.now() / 1000))
      if (rem === 0 && !firedRef.current) {
        firedRef.current = true
        onCountdownEnd?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [pending, finishesAt, onCountdownEnd])

  const now      = Math.floor(Date.now() / 1000)
  const remaining = pending ? 0 : Math.max(0, finishesAt - now)
  const total     = startedAt != null ? Math.max(1, finishesAt - startedAt) : remaining
  const pct       = total > 0 ? Math.max(0, Math.min(100, (total - remaining) / total * 100)) : (pending ? 0 : 100)
  const colorClass = { gold: 'text-gold', forest: 'text-forest-light', stone: 'text-ink-muted' }[color]

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2.5 mb-2">
        <span className={pending ? 'text-ink-muted/50' : colorClass}>{icon}</span>
        <span className="font-ui text-sm text-ink flex-1 min-w-0 truncate">{lbl}</span>
        <span className="font-ui text-xs tabular-nums text-ink-muted/60 shrink-0">
          {pending ? 'En cola' : remaining > 0 ? formatDuration(remaining) : 'Completado'}
        </span>
      </div>
      {!pending && (
        <div className="progress-track h-1">
          <div className="progress-fill transition-none" style={{ width: `${pct}%` }} />
        </div>
      )}
    </Card>
  )
}


// ── Military sheet content ────────────────────────────────────────────────────

interface UnitInfo { id: string; count: number; attack: number; shield: number; inQueue: unknown }

function UnitRow({ u, inMissions }: { u: UnitInfo; inMissions: Record<string, number> }) {
  const away      = inMissions[u.id] ?? 0
  const available = Math.max(0, u.count - away)
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 py-2.5 border-b border-gold/8 last:border-0">
      <span className="font-ui text-sm text-ink truncate">{unitLabel(u.id)}</span>
      <span className="font-ui text-sm tabular-nums text-ink text-right w-14">{u.count}</span>
      <span className={`font-ui text-sm tabular-nums text-right w-14 ${away > 0 ? 'text-crimson-light font-semibold' : 'text-ink-muted/30'}`}>
        {away > 0 ? `−${away}` : '—'}
      </span>
      <span className={`font-ui text-sm font-semibold tabular-nums text-right w-14 ${available > 0 ? 'text-forest-light' : 'text-ink-muted/30'}`}>
        {available}
      </span>
    </div>
  )
}

function MilitarySheetContent({ units, support, defenses, inMissions }: {
  units: UnitInfo[]
  support: UnitInfo[]
  defenses: UnitInfo[]
  inMissions: Record<string, number>
}) {
  const combatUnits  = units.filter(u => u.count > 0 || (inMissions[u.id] ?? 0) > 0)
  const supportUnits = support.filter(u => u.count > 0 || (inMissions[u.id] ?? 0) > 0)
  const defenseUnits = defenses.filter(u => u.count > 0 || (inMissions[u.id] ?? 0) > 0)
  const hasAway = Object.values(inMissions).some(n => n > 0)

  return (
    <div className="px-5 pb-6">
      {hasAway && (
        <p className="font-ui text-xs text-ink-muted py-3 border-b border-gold/10">
          Las unidades en misión se muestran en rojo y se descuentan del disponible.
        </p>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 py-2.5 border-b border-gold/15 sticky top-0 bg-surface">
        <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted">Unidad</span>
        <span className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted text-right w-14">Total</span>
        <span className="font-ui text-[0.6rem] uppercase tracking-widest text-crimson/70 text-right w-14">Misión</span>
        <span className="font-ui text-[0.6rem] uppercase tracking-widest text-forest/80 text-right w-14">Libre</span>
      </div>

      {combatUnits.length > 0 && (
        <div className="mt-4">
          <p className="section-heading mb-2">Combate</p>
          {combatUnits.map(u => <UnitRow key={u.id} u={u} inMissions={inMissions} />)}
        </div>
      )}
      {supportUnits.length > 0 && (
        <div className="mt-5">
          <p className="section-heading mb-2">Apoyo</p>
          {supportUnits.map(u => <UnitRow key={u.id} u={u} inMissions={inMissions} />)}
        </div>
      )}
      {defenseUnits.length > 0 && (
        <div className="mt-5">
          <p className="section-heading mb-2">Defensas</p>
          {defenseUnits.map(u => <UnitRow key={u.id} u={u} inMissions={inMissions} />)}
        </div>
      )}
      {combatUnits.length === 0 && supportUnits.length === 0 && defenseUnits.length === 0 && (
        <p className="font-body text-sm text-ink-muted text-center py-10">Sin unidades entrenadas todavía.</p>
      )}
    </div>
  )
}

// ── Mini mission row ──────────────────────────────────────────────────────────

function MiniMissionRow({ mission, onClick }: { mission: ArmyMission; onClick: () => void }) {
  const isReturning = mission.state === 'returning'
  const isExploring = mission.state === 'exploring'
  const meta        = MISSION_META[mission.missionType]
  const Icon        = meta.Icon
  const coord       = isReturning ? mission.origin : mission.target
  const targetTime  = isReturning
    ? (mission.returnTime ?? 0)
    : isExploring
      ? mission.arrivalTime + (mission.holdingTime ?? 0)
      : mission.arrivalTime
  const [secs, setSecs] = useState(() => Math.max(0, targetTime - Math.floor(Date.now() / 1000)))

  useEffect(() => {
    const id = setInterval(() => setSecs(Math.max(0, targetTime - Math.floor(Date.now() / 1000))), 1000)
    return () => clearInterval(id)
  }, [targetTime])

  const stateLabel   = isReturning ? 'Regresando' : isExploring ? 'Explorando' : 'En camino'
  const stateCls     = isReturning ? 'text-forest bg-forest/8' : 'text-gold-dim bg-gold/8'

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2.5 border-b border-gold/8 last:border-0 hover:bg-gold/4 -mx-4 px-4 transition-colors text-left"
    >
      <Icon size={14} className={`${meta.color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <span className="font-ui text-xs font-semibold text-ink">{meta.label}</span>
        <span className="font-ui text-[0.6rem] text-ink-muted/70 ml-2 tabular-nums">
          {coord.realm}:{coord.region}:{coord.slot}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`font-ui text-[0.6rem] font-semibold px-1.5 py-0.5 rounded-full ${stateCls}`}>
          {stateLabel}
        </span>
        <span className="font-ui text-xs tabular-nums text-ink-muted w-14 text-right">
          {formatDuration(secs)}
        </span>
      </div>
    </button>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-3">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="skeleton h-2.5 w-20" />
            <div className="skeleton h-7 w-48" />
            <div className="skeleton h-3 w-36" />
          </div>
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
        <div className="pt-4 border-t border-gold/10 flex gap-2">
          <div className="skeleton h-5 w-28 rounded-full" />
          <div className="skeleton h-5 w-20 rounded-full" />
        </div>
      </Card>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-3 space-y-2">
            <div className="skeleton h-2.5 w-12" />
            <div className="skeleton h-5 w-16" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="p-4 space-y-3">
            <div className="skeleton h-2 w-16" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </Card>
        ))}
      </div>
    </div>
  )
}
