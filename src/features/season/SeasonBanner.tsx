import { useState, useEffect } from 'react'
import { Swords, Timer, Trophy, Crown } from 'lucide-react'
import { useSeason } from './useSeason'
import { formatDuration } from '@/lib/format'

function useCountdown(targetSecs: number) {
  const [left, setLeft] = useState(() => Math.max(0, targetSecs - Math.floor(Date.now() / 1000)))
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, targetSecs - Math.floor(Date.now() / 1000))), 1000)
    return () => clearInterval(id)
  }, [targetSecs])
  return left
}

export function SeasonBanner() {
  const { data: season } = useSeason()
  const timeLeft = useCountdown(season?.seasonEnd ?? 0)

  if (!season?.seasonNumber) return null

  const isEnded = season.seasonState === 'ended'

  return (
    <div className={`w-full px-4 py-1.5 flex items-center gap-3 border-b
      ${isEnded
        ? 'bg-gold/5 border-gold/20'
        : 'bg-void/80 border-gold/10'
      }`}
    >
      {/* Season number */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isEnded
          ? <Trophy size={12} className="text-gold" />
          : <Crown  size={12} className="text-gold-dim" />
        }
        <span className="font-ui text-[0.6rem] text-gold-dim uppercase tracking-widest">
          T{season.seasonNumber}
        </span>
      </div>

      {/* Boss name */}
      {season.boss && (
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Swords size={11} className="text-crimson-light shrink-0" />
          <span className="font-ui text-[0.65rem] text-parchment-dim truncate">
            {season.boss.name}
          </span>
          {season.boss.kingdom && (
            <span className="font-body text-[0.55rem] text-ink-muted/50 shrink-0">
              R{season.boss.kingdom.realm}·{season.boss.kingdom.region}·{season.boss.kingdom.slot}
            </span>
          )}
        </div>
      )}

      {/* Right side: timer or winner */}
      <div className="shrink-0 ml-auto">
        {isEnded ? (
          season.winner ? (
            <span className="font-ui text-[0.6rem] text-gold">
              🏆 {season.winner.username ?? 'Desconocido'}
            </span>
          ) : (
            <span className="font-ui text-[0.6rem] text-ink-muted">Temporada finalizada</span>
          )
        ) : timeLeft > 0 ? (
          <div className="flex items-center gap-1">
            <Timer size={10} className="text-ink-muted/60" />
            <span className="font-ui text-[0.6rem] tabular-nums text-ink-muted">
              {formatDuration(timeLeft)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
