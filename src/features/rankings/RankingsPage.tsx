import { Trophy, Medal } from 'lucide-react'
import { GiLaurelCrown, GiScrollQuill } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useRankings, type RankingEntry } from '@/features/rankings/useRankings'
import { formatResource } from '@/lib/format'

export function RankingsPage() {
  const { data, isLoading } = useRankings()

  if (isLoading) return <RankingsSkeleton />

  const rankings = data?.rankings ?? []
  const top3 = rankings.slice(0, 3)
  const rest = rankings.slice(3)

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Clasificación</span>
        <h1 className="page-title mt-0.5">Rankings</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Clasificación general por recursos invertidos en edificios, investigación y unidades.
        </p>
      </div>

      {/* Podio top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 anim-fade-up-1">
          {top3.map(entry => (
            <PodiumCard key={entry.kingdomId} entry={entry} />
          ))}
        </div>
      )}

      {/* Tabla resto */}
      {rest.length > 0 && (
        <Card className="overflow-hidden anim-fade-up-2">
          <div className="divide-y divide-gold/8">
            {rest.map(entry => (
              <RankRow key={entry.kingdomId} entry={entry} />
            ))}
          </div>
        </Card>
      )}

      {rankings.length === 0 && (
        <Card className="p-10 text-center anim-fade-up-1">
          <GiScrollQuill size={32} className="text-ink-muted/20 mx-auto mb-3" />
          <p className="font-ui text-xs text-ink-muted/50">No hay jugadores aún</p>
        </Card>
      )}
    </div>
  )
}

function PodiumCard({ entry }: { entry: RankingEntry }) {
  const medals = [
    { Icon: GiLaurelCrown, color: 'text-gold', bg: 'bg-gold/8', border: 'border-gold/25' },
    { Icon: Medal, color: 'text-ink-muted', bg: 'bg-stone/5', border: 'border-gold/12' },
    { Icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200/50' },
  ]
  const m = medals[entry.rank - 1] ?? medals[2]

  return (
    <Card
      className={`p-5 flex flex-col items-center text-center gap-2 ${entry.isMe ? 'ring-2 ring-gold/40' : ''}`}
    >
      <div
        className={`w-11 h-11 rounded-full ${m.bg} border ${m.border} flex items-center justify-center`}
      >
        <m.Icon size={22} className={m.color} />
      </div>
      <div>
        <p className="font-ui text-xs text-ink-muted mb-0.5">#{entry.rank}</p>
        <p className="font-ui text-sm font-semibold text-ink leading-tight">{entry.name}</p>
        <p className="font-body text-xs text-ink-muted/70">{entry.username}</p>
      </div>
      <div className="mt-1">
        <p className="font-ui text-lg font-bold tabular-nums text-gold-dim">
          {formatResource(entry.points)}
        </p>
        <p className="font-body text-[0.65rem] text-ink-muted/50 uppercase tracking-wide">puntos</p>
      </div>
      {entry.isMe && (
        <Badge variant="gold" className="text-[0.6rem]">
          Tú
        </Badge>
      )}
      <p className="font-body text-[0.6rem] text-ink-muted/40">
        R{entry.realm} · {entry.region} · {entry.slot}
      </p>
    </Card>
  )
}

function RankRow({ entry }: { entry: RankingEntry }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 hover:bg-parchment-warm/40 transition-colors ${
        entry.isMe ? 'bg-gold/5' : ''
      }`}
    >
      <span className="font-ui text-xs tabular-nums text-ink-muted/60 w-6 text-right shrink-0">
        {entry.rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm font-medium text-ink truncate">{entry.name}</p>
        <p className="font-body text-xs text-ink-muted/60 truncate">
          {entry.username} · R{entry.realm} · {entry.region} · {entry.slot}
        </p>
      </div>
      {entry.isMe && (
        <Badge variant="gold" className="text-[0.6rem] shrink-0">
          Tú
        </Badge>
      )}
      <span className="font-ui text-sm font-semibold tabular-nums text-ink-mid shrink-0">
        {formatResource(entry.points)}
      </span>
    </div>
  )
}

function RankingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-20" />
        <div className="skeleton h-8 w-36" />
      </div>
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
