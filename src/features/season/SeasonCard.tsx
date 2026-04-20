import { useState, useEffect } from 'react'
import { GiDragonHead, GiLaurelCrown } from 'react-icons/gi'
import { Timer, Trophy } from 'lucide-react'
import { useSeason } from './useSeason'

function useCountdown(targetSecs: number) {
  const [left, setLeft] = useState(() => Math.max(0, targetSecs - Math.floor(Date.now() / 1000)))
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, targetSecs - Math.floor(Date.now() / 1000))), 1000)
    return () => clearInterval(id)
  }, [targetSecs])
  return left
}

function formatTimeLeft(seconds: number): string {
  const months  = Math.floor(seconds / (30 * 86400))
  const days    = Math.floor((seconds % (30 * 86400)) / 86400)
  const hours   = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (months > 0) return `${months}M ${days}d ${hours}h`
  if (days   > 0) return `${days}d ${hours}h`
  if (hours  > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function SeasonCard() {
  const { data: season } = useSeason()
  const timeLeft = useCountdown(season?.seasonEnd ?? 0)

  if (!season?.seasonNumber) return null

  const isEnded = season.seasonState === 'ended'

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border anim-fade-up ${
      isEnded ? 'bg-gold/5 border-gold/15' : 'bg-crimson/5 border-crimson/15'
    }`}>
      {isEnded
        ? <GiLaurelCrown size={14} className="text-gold shrink-0" />
        : <GiDragonHead  size={14} className="text-crimson-light shrink-0" />
      }

      <span className="font-ui text-xs font-semibold text-parchment-dim">
        Temporada {season.seasonNumber} — {isEnded ? 'Finalizada' : 'En curso'}
      </span>

      <div className="flex-1" />

      {isEnded && season.winner && (
        <div className="flex items-center gap-1 text-gold">
          <Trophy size={11} />
          <span className="font-ui text-xs font-semibold">{season.winner.username}</span>
        </div>
      )}

      {!isEnded && timeLeft > 0 && (
        <div className="flex items-center gap-1 text-parchment-dim/60">
          <Timer size={11} />
          <span className="font-ui text-xs tabular-nums">{formatTimeLeft(timeLeft)}</span>
        </div>
      )}
    </div>
  )
}
