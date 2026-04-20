import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { GiDragonHead, GiLaurelCrown, GiSwordman } from 'react-icons/gi'
import { Timer, Trophy, Swords } from 'lucide-react'
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

function difficultyStars(d: number): string {
  const n = Math.min(5, Math.max(1, Math.round(d)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function formatArmy(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function SeasonCard() {
  const { data: season } = useSeason()
  const timeLeft = useCountdown(season?.seasonEnd ?? 0)

  if (!season?.seasonNumber) return null

  const isEnded  = season.seasonState === 'ended'
  const boss     = season.boss
  const kingdom  = boss?.kingdom

  const attackUrl = kingdom
    ? `/armies?realm=${kingdom.realm}&region=${kingdom.region}&slot=${kingdom.slot}`
    : '/armies'

  return (
    <div className={`rounded-lg border anim-fade-up ${
      isEnded ? 'bg-gold/5 border-gold/15' : 'bg-crimson/5 border-crimson/15'
    }`}>
      {/* Row 1 — headline */}
      <div className="flex items-center gap-2.5 px-4 py-2">
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

      {/* Row 2 — boss info (only while active) */}
      {!isEnded && boss && (
        <div className="flex items-center gap-3 px-4 pb-2.5 flex-wrap">
          <span className="font-ui text-[0.65rem] font-semibold text-crimson-light/80 truncate max-w-[200px]">
            {boss.name}
          </span>
          <span className="font-ui text-[0.6rem] text-gold/70 tracking-wider" title={`Dificultad ${boss.difficulty}`}>
            {difficultyStars(boss.difficulty)}
          </span>
          {boss.armySize > 0 && (
            <span className="flex items-center gap-1 font-ui text-[0.6rem] text-parchment-dim/60">
              <GiSwordman size={10} />
              {formatArmy(boss.armySize)} tropas
            </span>
          )}
          <div className="flex-1" />
          <Link
            to={attackUrl}
            className="flex items-center gap-1 px-2.5 py-1 rounded border border-crimson/30 bg-crimson/10 font-ui text-[0.6rem] font-semibold text-crimson-light hover:bg-crimson/20 transition-colors shrink-0"
          >
            <Swords size={9} />
            Atacar
          </Link>
        </div>
      )}
    </div>
  )
}
