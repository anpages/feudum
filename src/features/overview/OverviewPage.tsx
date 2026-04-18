import { type ReactNode, useState, useEffect } from 'react'
import { Clock, TrendingUp, Hammer, FlaskConical, Swords, Send } from 'lucide-react'
import {
  GiWoodPile,
  GiStoneBlock,
  GiWheat,
  GiAnvil,
  GiSpellBook,
  GiCrossedSwords,
} from 'react-icons/gi'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResearch } from '@/features/research/useResearch'
import { useBuildings } from '@/features/buildings/useBuildings'
import { useBarracks } from '@/features/barracks/useBarracks'
import { useArmies } from '@/features/armies/useArmies'
import { useRankings } from '@/features/rankings/useRankings'
import { formatResource, formatDuration } from '@/lib/format'
import { label } from '@/lib/labels'
import { terrainInfo } from '@/lib/terrain'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const BUILDING_KEYS = [
  'sawmill', 'quarry', 'grainFarm', 'windmill', 'cathedral', 'workshop',
  'engineersGuild', 'barracks', 'granary', 'stonehouse', 'silo', 'academy',
  'alchemistTower', 'ambassadorHall', 'armoury',
] as const

const UNIT_KEYS = [
  'squire', 'knight', 'paladin', 'warlord', 'grandKnight', 'siegeMaster',
  'warMachine', 'dragonKnight', 'merchant', 'caravan', 'colonist', 'scavenger',
  'scout', 'beacon', 'archer', 'crossbowman', 'ballista', 'trebuchet',
  'mageTower', 'dragonCannon', 'palisade', 'castleWall', 'moat', 'catapult',
] as const

const COMBAT_KEYS = [
  'squire', 'knight', 'paladin', 'warlord', 'grandKnight', 'siegeMaster',
  'warMachine', 'dragonKnight',
] as const

const DEFENSE_KEYS = [
  'archer', 'crossbowman', 'ballista', 'trebuchet', 'mageTower',
  'dragonCannon', 'palisade', 'castleWall', 'moat', 'catapult',
] as const

export function OverviewPage() {
  const { data: kingdom, isLoading } = useKingdom()
  const { data: researchData } = useResearch()
  const { data: buildingsData } = useBuildings()
  const { data: barracksData } = useBarracks()
  const { data: armiesData } = useArmies()
  const { data: rankingsData } = useRankings()

  const buildingCount = kingdom
    ? BUILDING_KEYS.reduce((s, k) => s + (Number((kingdom as Record<string, unknown>)[k]) > 0 ? 1 : 0), 0)
    : 0
  const researchCount = researchData?.research.filter(r => r.level > 0).length ?? 0
  const combatCount = kingdom
    ? COMBAT_KEYS.reduce((s, k) => s + (Number((kingdom as Record<string, unknown>)[k]) || 0), 0)
    : 0
  const defenseCount = kingdom
    ? DEFENSE_KEYS.reduce((s, k) => s + (Number((kingdom as Record<string, unknown>)[k]) || 0), 0)
    : 0
  const totalTroops = kingdom
    ? UNIT_KEYS.reduce((s, k) => s + (Number((kingdom as Record<string, unknown>)[k]) || 0), 0)
    : 0

  const myRanking = rankingsData?.rankings.find(r => r.isMe)
  const activeMissions = armiesData?.missions.filter(m => m.state === 'active').length ?? 0
  const returningMissions = armiesData?.missions.filter(m => m.state === 'returning').length ?? 0

  const activeBuilding = buildingsData?.buildings.find(b => !!b.inQueue)
  const activeResearch = researchData?.research.find(r => !!r.inQueue)
  const allUnits = [
    ...(barracksData?.units ?? []),
    ...(barracksData?.support ?? []),
    ...(barracksData?.defenses ?? []),
  ]
  const activeUnit = allUnits.find(u => !!u.inQueue)
  const hasQueue = !!(activeBuilding || activeResearch || activeUnit)

  const terrain = kingdom ? terrainInfo(kingdom.terrain) : null

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
          {terrain && (
            <span className={`font-ui text-xs ${terrain.color} flex items-center gap-1 border border-current/20 rounded px-2 py-0.5`}>
              <span>{terrain.emoji}</span>
              <span>{terrain.label}</span>
              <span className="text-ink-muted/50">· {terrain.bonus}</span>
            </span>
          )}
          <Badge variant="stone">Puntos: {myRanking?.points.toLocaleString() ?? '—'}</Badge>
          <Badge variant="gold">Rango: {myRanking ? `#${myRanking.rank}` : '—'}</Badge>
        </div>
      </div>

      {/* ── Production rates ── */}
      <section>
        <span className="section-heading anim-fade-up-1">Producción por hora</span>
        <div className="grid grid-cols-3 gap-3 anim-fade-up-1">
          <ProductionCard
            icon={<GiWoodPile size={16} />}
            label="Madera"
            rate={kingdom?.woodProduction ?? 0}
            isBoosted={terrain?.label === 'Bosque'}
          />
          <ProductionCard
            icon={<GiStoneBlock size={16} />}
            label="Piedra"
            rate={kingdom?.stoneProduction ?? 0}
            isBoosted={terrain?.label === 'Montaña'}
          />
          <ProductionCard
            icon={<GiWheat size={16} />}
            label="Grano"
            rate={kingdom?.grainProduction ?? 0}
            isBoosted={terrain?.label === 'Llanura'}
          />
        </div>
      </section>

      {/* ── Military summary ── */}
      <section>
        <span className="section-heading anim-fade-up-2">Fuerza Militar</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 anim-fade-up-2">
          <StatCard
            icon={<GiCrossedSwords size={16} />}
            label="Combate"
            value={combatCount.toLocaleString()}
            note="unidades"
          />
          <StatCard
            icon={<Swords size={14} />}
            label="Defensa"
            value={defenseCount.toLocaleString()}
            note="unidades"
          />
          <StatCard
            icon={<Send size={13} />}
            label="En marcha"
            value={activeMissions.toString()}
            note={activeMissions === 1 ? 'misión activa' : 'misiones activas'}
            highlight={activeMissions > 0}
          />
          <StatCard
            icon={<Send size={13} className="rotate-180" />}
            label="Regresando"
            value={returningMissions.toString()}
            note={returningMissions === 1 ? 'misión' : 'misiones'}
            highlight={returningMissions > 0}
          />
        </div>
      </section>

      {/* ── Kingdom stats ── */}
      <section>
        <span className="section-heading anim-fade-up-3">Estado del Reino</span>
        <div className="grid grid-cols-3 gap-3 anim-fade-up-3">
          <StatCard
            icon={<GiAnvil size={16} />}
            label="Edificios"
            value={buildingCount.toString()}
            note="construidos"
          />
          <StatCard
            icon={<GiSpellBook size={16} />}
            label="Investigaciones"
            value={researchCount.toString()}
            note="descubiertas"
          />
          <StatCard
            icon={<GiCrossedSwords size={16} />}
            label="Tropas totales"
            value={totalTroops.toLocaleString()}
            note="en campo"
          />
        </div>
      </section>

      {/* ── Active queues ── */}
      <section>
        <span className="section-heading anim-fade-up-4">Colas Activas</span>
        {hasQueue ? (
          <div className="space-y-2 anim-fade-up-4">
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
          <Card className="p-4 anim-fade-up-4">
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
  icon, label: lbl, finishesAt, color,
}: {
  icon: ReactNode; label: string; finishesAt: number; color: 'gold' | 'forest' | 'stone'
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, finishesAt - Math.floor(Date.now() / 1000))
  )
  const [total] = useState(remaining)

  useEffect(() => {
    const id = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  const colorClass = { gold: 'text-gold', forest: 'text-forest-light', stone: 'text-ink-muted' }[color]
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
        <div className="progress-fill transition-none" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  )
}

function ProductionCard({
  icon, label, rate, isBoosted,
}: {
  icon: ReactNode; label: string; rate: number; isBoosted: boolean
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={isBoosted ? 'text-gold' : 'text-gold/60'}>{icon}</span>
        <span className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted truncate">
          {label}
        </span>
        {isBoosted && <Badge variant="gold" className="shrink-0">+25%</Badge>}
      </div>
      <p className="font-ui text-xl tabular-nums font-semibold text-ink leading-none">
        {formatResource(rate)}
      </p>
      <p className="flex items-center gap-1 mt-1.5 text-forest-light text-xs">
        <TrendingUp size={9} />
        <span className="tabular-nums">por hora</span>
      </p>
    </Card>
  )
}

function StatCard({
  icon, label, value, note, highlight,
}: {
  icon: ReactNode; label: string; value: string; note: string; highlight?: boolean
}) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className={`shrink-0 ${highlight ? 'text-gold' : 'text-gold/60'}`}>{icon}</span>
      <div className="min-w-0">
        <p className={`font-ui text-xl font-semibold leading-none ${highlight ? 'text-gold' : 'text-ink'}`}>
          {value}
        </p>
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
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-6 w-16" />
            </Card>
          ))}
        </div>
      </div>
      <div>
        <div className="skeleton h-2.5 w-16 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4 space-y-2">
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-6 w-10" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
