import { type ReactNode, useState, useEffect } from 'react'
import { Users, Clock, TrendingUp, Hammer, FlaskConical, Swords } from 'lucide-react'
import {
  GiWoodPile,
  GiStoneBlock,
  GiWheat,
  GiAnvil,
  GiSpellBook,
  GiCrossedSwords,
} from 'react-icons/gi'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResourceTicker } from '@/features/kingdom/useResourceTicker'
import { useResearch } from '@/features/research/useResearch'
import { useBuildings } from '@/features/buildings/useBuildings'
import { useBarracks } from '@/features/barracks/useBarracks'
import { useRankings } from '@/features/rankings/useRankings'
import { formatResource, formatDuration } from '@/lib/format'
import { label } from '@/lib/labels'
import { terrainInfo } from '@/lib/terrain'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'

const BUILDING_KEYS = [
  'sawmill',
  'quarry',
  'grainFarm',
  'windmill',
  'cathedral',
  'workshop',
  'engineersGuild',
  'barracks',
  'granary',
  'stonehouse',
  'silo',
  'academy',
  'alchemistTower',
  'ambassadorHall',
  'armoury',
] as const

const UNIT_KEYS = [
  'squire',
  'knight',
  'paladin',
  'warlord',
  'grandKnight',
  'siegeMaster',
  'warMachine',
  'dragonKnight',
  'merchant',
  'caravan',
  'colonist',
  'scavenger',
  'scout',
  'beacon',
  'archer',
  'crossbowman',
  'ballista',
  'trebuchet',
  'mageTower',
  'dragonCannon',
  'palisade',
  'castleWall',
  'moat',
  'catapult',
] as const

export function OverviewPage() {
  const { data: kingdom, isLoading } = useKingdom()
  const { data: researchData } = useResearch()
  const { data: buildingsData } = useBuildings()
  const { data: barracksData } = useBarracks()
  const { data: rankingsData } = useRankings()
  const resources = useResourceTicker(kingdom)

  const buildingCount = kingdom
    ? BUILDING_KEYS.reduce(
        (s, k) => s + (Number((kingdom as Record<string, unknown>)[k]) > 0 ? 1 : 0),
        0
      )
    : 0
  const researchCount = researchData?.research.filter(r => r.level > 0).length ?? 0
  const troopCount = kingdom
    ? UNIT_KEYS.reduce((s, k) => s + (Number((kingdom as Record<string, unknown>)[k]) || 0), 0)
    : 0

  const myRanking = rankingsData?.rankings.find(r => r.isMe)

  const activeBuilding = buildingsData?.buildings.find(b => !!b.inQueue)
  const activeResearch = researchData?.research.find(r => !!r.inQueue)
  const allUnits = [
    ...(barracksData?.units ?? []),
    ...(barracksData?.support ?? []),
    ...(barracksData?.defenses ?? []),
  ]
  const activeUnit = allUnits.find(u => !!u.inQueue)

  const hasQueue = !!(activeBuilding || activeResearch || activeUnit)

  if (isLoading) return <OverviewSkeleton />

  return (
    <div className="space-y-8">
      {/* ── Kingdom header ── */}
      <div className="anim-fade-up flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="section-heading">Panel de mando</span>
          <h1 className="page-title mt-0.5">Resumen</h1>
          <p className="font-body text-ink-muted text-sm mt-1.5">
            R{kingdom?.realm ?? '—'} · Región {kingdom?.region ?? '—'} · Pos. {kingdom?.slot ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {kingdom?.terrain && (() => {
            const t = terrainInfo(kingdom.terrain)
            return (
              <span className={`font-ui text-xs ${t.color} flex items-center gap-1 border border-current/20 rounded px-2 py-0.5`}>
                <span>{t.emoji}</span>
                <span>{t.label}</span>
                <span className="text-ink-muted/50">· {t.bonus}</span>
              </span>
            )
          })()}
          <Badge variant="stone">Puntos: {myRanking?.points.toLocaleString() ?? '—'}</Badge>
          <Badge variant="gold">Rango: {myRanking ? `#${myRanking.rank}` : '—'}</Badge>
        </div>
      </div>

      {/* ── Resource storage ── */}
      <section>
        <span className="section-heading anim-fade-up-1">Almacenes</span>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <ResourceCard
            icon={<GiWoodPile size={18} />}
            label="Madera"
            value={resources.wood}
            cap={kingdom?.woodCapacity ?? 5000}
            rate={kingdom?.woodProduction ?? 0}
            animClass="anim-fade-up-1"
          />
          <ResourceCard
            icon={<GiStoneBlock size={18} />}
            label="Piedra"
            value={resources.stone}
            cap={kingdom?.stoneCapacity ?? 5000}
            rate={kingdom?.stoneProduction ?? 0}
            animClass="anim-fade-up-2"
          />
          <ResourceCard
            icon={<GiWheat size={18} />}
            label="Grano"
            value={resources.grain}
            cap={kingdom?.grainCapacity ?? 5000}
            rate={kingdom?.grainProduction ?? 0}
            animClass="anim-fade-up-3"
          />
          <ResourceCard
            icon={<Users size={17} />}
            label="Población"
            value={kingdom?.populationUsed ?? 0}
            cap={kingdom?.populationMax ?? 200}
            rate={0}
            animClass="anim-fade-up-4"
          />
        </div>
      </section>

      {/* ── Kingdom stats ── */}
      <section>
        <span className="section-heading anim-fade-up-2">Estado del Reino</span>
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<GiAnvil size={16} />}
            label="Edificios"
            value={buildingCount.toString()}
            note="construidos"
            animClass="anim-fade-up-2"
          />
          <StatCard
            icon={<GiSpellBook size={16} />}
            label="Investigaciones"
            value={researchCount.toString()}
            note="descubiertas"
            animClass="anim-fade-up-3"
          />
          <StatCard
            icon={<GiCrossedSwords size={16} />}
            label="Tropas"
            value={troopCount.toLocaleString()}
            note="en campo"
            animClass="anim-fade-up-4"
          />
        </div>
      </section>

      {/* ── Active queues ── */}
      <section>
        <span className="section-heading anim-fade-up-3">Colas Activas</span>
        {hasQueue ? (
          <div className="space-y-2 anim-fade-up-3">
            {activeBuilding && (
              <QueueRow
                icon={<Hammer size={13} />}
                label={`${label(activeBuilding.id)} → Nv. ${activeBuilding.inQueue!.level}`}
                finishesAt={activeBuilding.inQueue!.finishesAt}
                color="gold"
              />
            )}
            {activeResearch && (
              <QueueRow
                icon={<FlaskConical size={13} />}
                label={`${label(activeResearch.id)} → Nv. ${activeResearch.inQueue!.level}`}
                finishesAt={activeResearch.inQueue!.finishesAt}
                color="forest"
              />
            )}
            {activeUnit && (
              <QueueRow
                icon={<Swords size={13} />}
                label={`${label(activeUnit.id)} × ${activeUnit.inQueue!.amount}`}
                finishesAt={activeUnit.inQueue!.finishesAt}
                color="stone"
              />
            )}
          </div>
        ) : (
          <Card className="p-4 anim-fade-up-3">
            <div className="flex items-center gap-3 text-ink-muted/60">
              <Clock size={15} />
              <span className="font-body text-sm">No hay colas activas</span>
            </div>
          </Card>
        )}
      </section>
    </div>
  )
}

function QueueRow({
  icon,
  label: lbl,
  finishesAt,
  color,
}: {
  icon: ReactNode
  label: string
  finishesAt: number
  color: 'gold' | 'forest' | 'stone'
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, finishesAt - Math.floor(Date.now() / 1000))
  )
  const [total] = useState(remaining)

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(r => Math.max(0, r - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const colorClass = {
    gold: 'text-gold',
    forest: 'text-forest-light',
    stone: 'text-ink-muted',
  }[color]

  const pct = total > 0 ? Math.max(0, Math.min(100, ((total - remaining) / total) * 100)) : 100

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2.5 mb-2">
        <span className={colorClass}>{icon}</span>
        <span className="font-ui text-sm text-ink flex-1 min-w-0 truncate">{lbl}</span>
        <span className="font-ui text-xs tabular-nums text-ink-muted shrink-0">
          {remaining > 0 ? formatDuration(remaining) : 'Completado'}
        </span>
      </div>
      <div className="progress-track h-1">
        <div className={`progress-fill transition-none`} style={{ width: `${pct}%` }} />
      </div>
    </Card>
  )
}

function ResourceCard({
  icon,
  label,
  value,
  cap,
  rate,
  animClass,
}: {
  icon: ReactNode
  label: string
  value: number
  cap: number
  rate: number
  animClass: string
}) {
  const isFull = value >= cap
  return (
    <Card className={`p-4 ${animClass}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={isFull ? 'text-crimson' : 'text-gold'}>{icon}</span>
          <span className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {label}
          </span>
        </div>
        {isFull && <Badge variant="crimson">Lleno</Badge>}
      </div>

      <p
        className={`font-ui text-xl tabular-nums font-semibold ${isFull ? 'text-crimson' : 'text-ink'}`}
      >
        {formatResource(value)}
      </p>
      <p className="text-xs text-ink-muted/60 tabular-nums mb-3">/ {formatResource(cap)}</p>

      <ProgressBar value={value} max={cap} />

      {rate > 0 && (
        <p className="mt-2 flex items-center gap-1 text-forest-light text-xs">
          <TrendingUp size={9} />
          <span className="tabular-nums">+{formatResource(rate)}/h</span>
        </p>
      )}
    </Card>
  )
}

function StatCard({
  icon,
  label,
  value,
  note,
  animClass,
}: {
  icon: ReactNode
  label: string
  value: string
  note: string
  animClass: string
}) {
  return (
    <Card className={`p-4 flex items-center gap-3 ${animClass}`}>
      <span className="text-gold/60 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-ui text-xl font-semibold text-ink leading-none">{value}</p>
        <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mt-0.5 truncate">
          {label}
        </p>
        <p className="font-body text-xs text-ink-muted/60 mt-0.5">{note}</p>
      </div>
    </Card>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-14" />
        <div className="skeleton h-8 w-52" />
        <div className="skeleton h-3 w-36" />
      </div>
      <div>
        <div className="skeleton h-2.5 w-16 mb-4" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="flex justify-between">
                <div className="skeleton h-3 w-20" />
                <div className="skeleton h-4 w-10" />
              </div>
              <div className="skeleton h-6 w-24" />
              <div className="skeleton h-3 w-16" />
              <div className="progress-track">
                <div className="progress-fill w-0" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
