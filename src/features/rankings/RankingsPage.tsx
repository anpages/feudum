import { useState } from 'react'
import { Trophy, Medal, Users, Cpu } from 'lucide-react'
import { GiLaurelCrown, GiScrollQuill, GiAnvil, GiSpellBook, GiCrossedSwords, GiWheat, GiCastle, GiRobotGolem, GiDragonHead } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useRankings, type RankingCategory, type RankingPlayerType, type RankingEntry } from '@/features/rankings/useRankings'
import { formatResource } from '@/lib/format'

// ── Category tabs ─────────────────────────────────────────────────────────────

const CATEGORIES: { id: RankingCategory; label: string; Icon: React.ComponentType<{ size?: number; className?: string }>, unit: string }[] = [
  { id: 'total',     label: 'General',       Icon: Trophy,         unit: 'pts' },
  { id: 'buildings', label: 'Edificios',     Icon: GiAnvil,        unit: 'pts' },
  { id: 'research',  label: 'Investigación', Icon: GiSpellBook,    unit: 'pts' },
  { id: 'units',     label: 'Tropas',        Icon: GiCrossedSwords,unit: 'pts' },
  { id: 'economy',   label: 'Economía',      Icon: GiWheat,        unit: 'pts' },
]

const PLAYER_TYPES: { id: RankingPlayerType; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'players', label: 'Jugadores', Icon: Users },
  { id: 'npcs',    label: 'NPCs',      Icon: Cpu },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export function RankingsPage() {
  const [category, setCategory]     = useState<RankingCategory>('total')
  const [playerType, setPlayerType] = useState<RankingPlayerType>('players')
  const { data, isLoading } = useRankings(category, playerType)

  const rankings = data?.rankings ?? []
  const top3 = rankings.slice(0, 3)
  const rest = rankings.slice(3)
  const cat = CATEGORIES.find(c => c.id === category)!

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Clasificación</span>
        <h1 className="page-title mt-0.5">Rankings</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Compara tu progreso con el resto de reinos del universo.
        </p>
      </div>

      {/* Player type tabs */}
      <div className="anim-fade-up-1 flex gap-1 p-1 bg-obsidian border border-gold/10 rounded-lg w-fit">
        {PLAYER_TYPES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setPlayerType(id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded font-ui text-xs font-semibold transition-all ${
              playerType === id
                ? 'bg-gold/15 border border-gold/30 text-gold-dim shadow-sm'
                : 'text-ink-muted hover:text-ink-mid'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="anim-fade-up-1 flex gap-1.5 flex-wrap">
        {CATEGORIES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setCategory(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-ui text-xs font-semibold transition-all ${
              category === id
                ? 'bg-gold-soft border-gold/30 text-gold-dim shadow-sm'
                : 'border-gold/10 text-ink-muted hover:border-gold/20 hover:bg-parchment-warm'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <RankingsSkeleton />
      ) : rankings.length === 0 ? (
        <Card className="p-10 text-center anim-fade-up-2">
          <GiScrollQuill size={32} className="text-ink-muted/20 mx-auto mb-3" />
          <p className="font-ui text-xs text-ink-muted/50">No hay jugadores aún</p>
        </Card>
      ) : (
        <>
          {/* Podio top 3 */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 anim-fade-up-2">
              {top3.map(entry => (
                <PodiumCard key={entry.kingdomId} entry={entry} unit={cat.unit} />
              ))}
            </div>
          )}

          {/* Tabla resto */}
          {rest.length > 0 && (
            <Card className="overflow-hidden anim-fade-up-3">
              <div className="divide-y divide-gold/8">
                {rest.map(entry => (
                  <RankRow key={entry.kingdomId} entry={entry} unit={cat.unit} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ── Podium card ───────────────────────────────────────────────────────────────

function PodiumCard({ entry, unit }: { entry: RankingEntry; unit: string }) {
  const medals = [
    { Icon: GiLaurelCrown, color: 'text-gold',       bg: 'bg-gold/8',      border: 'border-gold/25' },
    { Icon: Medal,          color: 'text-ink-muted',  bg: 'bg-stone/5',     border: 'border-gold/12' },
    { Icon: Trophy,         color: 'text-amber-600',  bg: 'bg-amber-50',    border: 'border-amber-200/50' },
  ]
  const m = medals[entry.rank - 1] ?? medals[2]

  return (
    <Card className={`p-5 flex flex-col items-center text-center gap-2 ${entry.isMe ? 'ring-2 ring-gold/40' : ''}`}>
      <div className={`w-11 h-11 rounded-full ${m.bg} border ${m.border} flex items-center justify-center`}>
        <m.Icon size={22} className={m.color} />
      </div>
      <div>
        <p className="font-ui text-xs text-ink-muted mb-0.5">#{entry.rank}</p>
        <p className="font-ui text-sm font-semibold text-ink leading-tight flex items-center justify-center gap-1">
          {entry.isNpc && <GiRobotGolem size={12} className="text-ink-muted/50" />}
          {entry.name}
        </p>
        <p className="font-body text-xs text-ink-muted/70">
          {entry.isBoss ? '⚔ Jefe' : entry.isNpc ? `NPC Nv.${entry.npcLevel ?? 1}` : `@${entry.username}`}
        </p>
      </div>
      <div className="mt-1">
        <p className="font-ui text-lg font-bold tabular-nums text-gold-dim">
          {formatResource(entry.points)}
        </p>
        <p className="font-body text-[0.65rem] text-ink-muted/50 uppercase tracking-wide">{unit}</p>
      </div>
      {entry.isMe && <Badge variant="gold" className="text-[0.6rem]">Tú</Badge>}
      <p className="font-body text-[0.6rem] text-ink-muted/40">
        R{entry.realm} · {entry.region} · {entry.slot}
      </p>
    </Card>
  )
}

// ── Rank row ──────────────────────────────────────────────────────────────────

function RankRow({ entry, unit }: { entry: RankingEntry; unit: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-parchment-warm/40 transition-colors ${entry.isMe ? 'bg-gold/5' : ''}`}>
      <span className="font-ui text-xs tabular-nums text-ink-muted/60 w-6 text-right shrink-0">
        {entry.rank}
      </span>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${entry.isBoss ? 'bg-crimson/15 border border-crimson/30' : entry.isNpc ? 'bg-parchment-warm border border-gold/15' : 'bg-gold/8 border border-gold/20'}`}>
        {entry.isBoss
          ? <GiDragonHead size={13} className="text-crimson-light" />
          : entry.isNpc
            ? <GiRobotGolem size={13} className="text-ink-muted/50" />
            : <GiCastle size={13} className="text-gold-dim" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm font-medium text-ink truncate">{entry.name}</p>
        <p className="font-body text-xs text-ink-muted/60 truncate">
          {entry.isBoss ? '⚔ Jefe de temporada' : entry.isNpc ? `NPC Nv.${entry.npcLevel ?? 1}` : `@${entry.username}`}
          {' '}· R{entry.realm} · {entry.region} · {entry.slot}
        </p>
      </div>
      {entry.isMe && <Badge variant="gold" className="text-[0.6rem] shrink-0">Tú</Badge>}
      {entry.isBoss && <Badge variant="crimson" className="text-[0.6rem] shrink-0">Jefe</Badge>}
      {entry.isNpc && !entry.isBoss && <Badge variant="stone" className="text-[0.6rem] shrink-0">NPC</Badge>}
      <span className="font-ui text-sm font-semibold tabular-nums text-ink-mid shrink-0">
        {formatResource(entry.points)} <span className="text-ink-muted/50 text-xs">{unit}</span>
      </span>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RankingsSkeleton() {
  return (
    <div className="space-y-6 anim-fade-up-2">
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-5 flex flex-col items-center gap-3">
            <div className="skeleton w-11 h-11 rounded-full" />
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-5 w-16" />
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gold/8">
            <div className="skeleton h-3 w-6" />
            <div className="skeleton w-7 h-7 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-2.5 w-24" />
            </div>
            <div className="skeleton h-3 w-16" />
          </div>
        ))}
      </Card>
    </div>
  )
}
