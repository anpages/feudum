import { type ReactNode, useState, useEffect } from 'react'
import { Clock, TrendingUp, Hammer, FlaskConical, Swords, Send, Shield, ChevronRight, Zap, TreePine, Mountain, Wheat } from 'lucide-react'
import {
  GiAnvil, GiSpellBook, GiCrossedSwords,
} from 'react-icons/gi'
import { useNavigate } from 'react-router-dom'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { useResearch } from '@/features/research/useResearch'
import { useBuildings } from '@/features/buildings/useBuildings'
import { useBarracks } from '@/features/barracks/useBarracks'
import { useArmies } from '@/features/armies/useArmies'
import { useRankings } from '@/features/rankings/useRankings'
import { useAuth } from '@/features/auth/useAuth'
import { formatResource, formatDuration } from '@/lib/format'
import { label } from '@/lib/labels'
import { tempLabel } from '@/lib/terrain'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SeasonCard } from '@/features/season/SeasonCard'

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
  const { data: kingdom, isLoading } = useKingdom()
  const resources = useResourceTicker(kingdom)
  const { data: researchData } = useResearch()
  const { data: buildingsData } = useBuildings()
  const { data: barracksData } = useBarracks()
  const { data: armiesData } = useArmies()
  const { data: rankingsData } = useRankings()
  const { user } = useAuth()

  const buildingCount = kingdom
    ? BUILDING_KEYS.reduce((s, k) => s + (Number((kingdom as Record<string, unknown>)[k]) > 0 ? 1 : 0), 0)
    : 0
  const buildingTotalLevels = kingdom
    ? BUILDING_KEYS.reduce((s, k) => s + (Number((kingdom as Record<string, unknown>)[k]) || 0), 0)
    : 0
  const researchCount = researchData?.research.filter(r => r.level > 0).length ?? 0
  const researchTotalLevels = researchData?.research.reduce((s, r) => s + r.level, 0) ?? 0

  const allBarracksUnits = [...(barracksData?.units ?? []), ...(barracksData?.support ?? []), ...(barracksData?.defenses ?? [])]
  const totalAttackPower = allBarracksUnits.reduce((s, u) => s + u.count * u.attack, 0)
  const totalShieldPower = allBarracksUnits.reduce((s, u) => s + u.count * u.shield, 0)
  const totalUnitCount   = allBarracksUnits.reduce((s, u) => s + u.count, 0)
  const myRanking = rankingsData?.rankings.find(r => r.isMe)
  const activeMissions = armiesData?.missions.filter(m => m.state === 'active').length ?? 0
  const returningMissions = armiesData?.missions.filter(m => m.state === 'returning').length ?? 0

  const queuedBuildings = buildingsData?.buildings.filter(b => !!b.inQueue)
    .sort((a, b) => a.inQueue!.finishesAt - b.inQueue!.finishesAt) ?? []
  const queuedResearch = researchData?.research.filter(r => !!r.inQueue)
    .sort((a, b) => a.inQueue!.finishesAt - b.inQueue!.finishesAt) ?? []
  const allUnits = [...(barracksData?.units ?? []), ...(barracksData?.support ?? []), ...(barracksData?.defenses ?? [])]
  const queuedUnits = allUnits.filter(u => !!u.inQueue)
  const hasQueue = !!(queuedBuildings.length || queuedResearch.length || queuedUnits.length)

  const tempAvg = (kingdom as Record<string, unknown> | null)?.tempAvg as number | undefined
  const charClass = user?.characterClass ? CLASS_INFO[user.characterClass] : null

  if (isLoading) return <OverviewSkeleton />

  return (
    <div className="space-y-6">

      {/* ── Season card ── */}
      <SeasonCard />

      {/* ── Kingdom identity banner ── */}
      <Card className="p-5 anim-fade-up">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-body text-xs text-ink-muted/60 uppercase tracking-widest mb-1">Panel de mando</p>
            <h1 className="font-display text-2xl text-gold-dim leading-tight">{kingdom?.name ?? '—'}</h1>
            <p className="font-body text-sm text-ink-muted mt-1">
              Reino {kingdom?.realm ?? '—'} · Región {kingdom?.region ?? '—'} · Posición {kingdom?.slot ?? '—'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="gold">Rango #{myRanking?.rank ?? '—'}</Badge>
            <span className="font-ui text-xs tabular-nums text-ink-muted">
              {myRanking?.points.toLocaleString() ?? '—'} pts
            </span>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gold/10">
          {tempAvg !== undefined && (
            <span className="inline-flex items-center gap-1.5 font-ui text-xs px-2.5 py-1 rounded-full border text-ink-muted/70 border-current/20 bg-current/5">
              🌡️ {tempLabel(tempAvg)}
            </span>
          )}
          {charClass && (
            <span className={`inline-flex items-center gap-1.5 font-ui text-xs px-2.5 py-1 rounded-full border ${charClass.color} border-current/25 bg-current/5`}>
              {charClass.emoji} {charClass.label}
            </span>
          )}
          {!charClass && (
            <button
              onClick={() => navigate('/profile')}
              className="inline-flex items-center gap-1.5 font-ui text-xs px-2.5 py-1 rounded-full border border-gold/20 text-ink-muted/60 hover:text-gold hover:border-gold/40 transition-colors"
            >
              Elige una clase de personaje →
            </button>
          )}
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
              <div className="flex items-center justify-between mb-3">
                <span className="section-heading mb-0">Producción por hora</span>
                {deficit && (
                  <span className="flex items-center gap-1 font-ui text-[0.6rem] text-crimson font-semibold uppercase tracking-wide">
                    <Zap size={9} />
                    Energía al {Math.round(factor * 100)}% — producción reducida
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <ProductionRow icon={<TreePine size={14} />} label="Madera" rate={kingdom?.woodProduction ?? 0}  current={resources.wood}  cap={kingdom?.woodCapacity}  deficit={deficit} />
                <ProductionRow icon={<Mountain size={14} />} label="Piedra" rate={kingdom?.stoneProduction ?? 0} current={resources.stone} cap={kingdom?.stoneCapacity} deficit={deficit} />
                <ProductionRow icon={<Wheat size={14} />}    label="Grano"  rate={kingdom?.grainProduction ?? 0} current={resources.grain} cap={kingdom?.grainCapacity} deficit={deficit} />
              </div>
            </>
          )
        })()}
      </section>

      {/* ── Stats + missions in a horizontal layout ── */}
      <section className="anim-fade-up-2">
        <span className="section-heading">Estado</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Kingdom stats */}
          <Card className="p-4 space-y-3">
            <p className="font-ui text-[0.6rem] text-ink-muted/60 uppercase tracking-widest">Desarrollo</p>
            <StatRow icon={<GiAnvil size={13} />} label="Edificios" value={`${buildingCount}`} note={`Nv. total ${buildingTotalLevels}`} onClick={() => navigate('/resources')} />
            <StatRow icon={<GiSpellBook size={13} />} label="Investigaciones" value={`${researchCount}`} note={`Nv. total ${researchTotalLevels}`} onClick={() => navigate('/research')} />
          </Card>

          {/* Military stats */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-ui text-[0.6rem] text-ink-muted/60 uppercase tracking-widest">Fuerza militar</p>
              <p className="font-ui text-[0.6rem] text-ink-muted/50 tabular-nums">{totalUnitCount} unidades</p>
            </div>
            <StatRow icon={<GiCrossedSwords size={13} />} label="Potencia ofensiva" value={formatResource(totalAttackPower)} onClick={() => navigate('/barracks')} />
            <StatRow icon={<Shield size={13} />} label="Potencia defensiva" value={formatResource(totalShieldPower)} onClick={() => navigate('/defense')} />
          </Card>

          {/* Active missions */}
          {(activeMissions > 0 || returningMissions > 0) && (
            <Card className="p-4 space-y-3 sm:col-span-2">
              <p className="font-ui text-[0.6rem] text-ink-muted/60 uppercase tracking-widest">Misiones en marcha</p>
              {activeMissions > 0 && (
                <StatRow icon={<Send size={12} />} label="En camino" value={`${activeMissions}`} note={activeMissions === 1 ? 'misión activa' : 'misiones activas'} highlight onClick={() => navigate('/armies')} />
              )}
              {returningMissions > 0 && (
                <StatRow icon={<Send size={12} className="rotate-180" />} label="Regresando" value={`${returningMissions}`} note={returningMissions === 1 ? 'misión' : 'misiones'} highlight onClick={() => navigate('/armies')} />
              )}
            </Card>
          )}

        </div>
      </section>

      {/* ── Active queues ── */}
      <section className="anim-fade-up-3">
        <span className="section-heading">Colas activas</span>
        {hasQueue ? (
          <div className="space-y-2">
            {queuedBuildings.map(b => (
              <QueueRow
                key={b.id}
                icon={<Hammer size={13} />}
                label={`${label(b.id)} → Nv. ${b.inQueue!.level}`}
                finishesAt={b.inQueue!.finishesAt}
                startedAt={b.inQueue!.startedAt}
                color="gold"
              />
            ))}
            {queuedResearch.map(r => (
              <QueueRow
                key={r.id}
                icon={<FlaskConical size={13} />}
                label={`${label(r.id)} → Nv. ${r.inQueue!.level}`}
                finishesAt={r.inQueue!.finishesAt}
                startedAt={r.inQueue!.startedAt}
                color="forest"
              />
            ))}
            {queuedUnits.map(u => (
              <QueueRow
                key={u.id}
                icon={<Swords size={13} />}
                label={`${label(u.id)} × ${u.inQueue!.amount}`}
                finishesAt={u.inQueue!.finishesAt}
                color="stone"
              />
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <div className="flex items-center gap-3 text-ink-muted/50">
              <Clock size={14} />
              <span className="font-body text-sm">No hay colas activas</span>
            </div>
          </Card>
        )}
      </section>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProductionRow({
  icon, label, rate, current, cap, deficit,
}: { icon: ReactNode; label: string; rate: number; current?: number; cap?: number; deficit?: boolean }) {
  const pct = cap && cap > 0 ? Math.min(100, ((current ?? 0) / cap) * 100) : 0
  const full = cap !== undefined && (current ?? 0) >= cap
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
      <p className={`flex items-center gap-0.5 mt-1 text-[0.6rem] ${deficit ? 'text-crimson/60' : 'text-forest-light'}`}>
        <TrendingUp size={8} />
        <span>/h · neto</span>
      </p>
      {cap !== undefined && (
        <div className="mt-2 pt-2 border-t border-gold/10 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-ui text-[0.6rem] text-ink-muted/50">Almacén</span>
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

function StatRow({
  icon, label: lbl, value, note, highlight, onClick,
}: { icon: ReactNode; label: string; value: string; note?: string; highlight?: boolean; onClick?: () => void }) {
  return (
    <button
      className="w-full flex items-center gap-2.5 group hover:opacity-80 transition-opacity text-left"
      onClick={onClick}
    >
      <span className={`shrink-0 ${highlight ? 'text-gold' : 'text-gold/50'}`}>{icon}</span>
      <span className={`font-ui text-sm font-semibold tabular-nums ${highlight ? 'text-gold' : 'text-ink'}`}>{value}</span>
      <span className="font-ui text-xs text-ink-muted">{lbl}</span>
      <span className="font-body text-xs text-ink-muted/50 ml-auto">{note}</span>
      <ChevronRight size={12} className="text-ink-muted/30 group-hover:text-ink-muted/60 shrink-0" />
    </button>
  )
}

function QueueRow({
  icon, label: lbl, finishesAt, startedAt, color,
}: { icon: ReactNode; label: string; finishesAt: number; startedAt?: number; color: 'gold' | 'forest' | 'stone' }) {
  const nowSec = Math.floor(Date.now() / 1000)
  const pending = startedAt !== undefined && startedAt > nowSec
  const [remaining, setRemaining] = useState(() =>
    pending ? 0 : Math.max(0, finishesAt - nowSec)
  )
  const [total] = useState(pending ? 0 : Math.max(0, finishesAt - nowSec))

  useEffect(() => {
    if (pending) return
    const id = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [pending])

  const colorClass = { gold: 'text-gold', forest: 'text-forest-light', stone: 'text-ink-muted' }[color]
  const pct = total > 0 ? Math.max(0, Math.min(100, ((total - remaining) / total) * 100)) : (pending ? 0 : 100)

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
