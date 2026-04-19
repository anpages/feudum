import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { GiDragonHead, GiSwordman, GiLaurelCrown } from 'react-icons/gi'
import { Timer, Swords, Trophy } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
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

export function SeasonCard() {
  const { data: season } = useSeason()
  const navigate = useNavigate()
  const timeLeft = useCountdown(season?.seasonEnd ?? 0)

  if (!season?.seasonNumber) return null

  const isEnded  = season.seasonState === 'ended'
  const boss     = season.boss
  const armySize = boss?.armySize ?? 0

  return (
    <Card className="overflow-hidden anim-fade-up">
      {/* Header bar */}
      <div className={`px-5 py-3 flex items-center justify-between gap-3 ${isEnded ? 'bg-gold/10' : 'bg-crimson/8'}`}>
        <div className="flex items-center gap-2">
          {isEnded
            ? <GiLaurelCrown size={18} className="text-gold" />
            : <GiDragonHead  size={18} className="text-crimson-light" />
          }
          <span className="font-ui text-xs font-bold tracking-widest uppercase text-ink-mid">
            {isEnded ? 'Temporada Finalizada' : `Temporada ${season.seasonNumber} — En curso`}
          </span>
        </div>
        {!isEnded && timeLeft > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Timer size={12} className="text-ink-muted/60" />
            <span className="font-ui text-xs tabular-nums text-ink-muted font-semibold">
              {formatDuration(timeLeft)}
            </span>
          </div>
        )}
        {isEnded && season.winner && (
          <div className="flex items-center gap-1.5">
            <Trophy size={12} className="text-gold" />
            <span className="font-ui text-xs text-gold font-semibold">
              {season.winner.username ?? 'Desconocido'}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {boss ? (
          <div className="flex items-start gap-4 flex-wrap">
            {/* Boss icon */}
            <div className="w-14 h-14 rounded-xl bg-crimson/10 border border-crimson/20 flex items-center justify-center shrink-0">
              <GiDragonHead size={30} className="text-crimson-light" />
            </div>

            {/* Boss info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-ui text-base font-bold text-ink">{boss.name}</h3>
                <Badge variant="crimson">Jefe Final</Badge>
                {boss.kingdom && (
                  <span className="font-body text-xs text-ink-muted/60">
                    R{boss.kingdom.realm}·{boss.kingdom.region}·{boss.kingdom.slot}
                  </span>
                )}
              </div>
              <p className="font-body text-xs text-ink-muted/70 leading-relaxed mb-3">
                {boss.lore}
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <GiSwordman size={14} className="text-crimson/70" />
                  <span className="font-ui text-xs text-ink-muted">
                    <span className="font-bold text-ink">{armySize.toLocaleString()}</span> tropas
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Swords size={12} className="text-ink-muted/50" />
                  <span className="font-ui text-xs text-ink-muted">
                    Dificultad <span className="font-bold text-ink">{'★'.repeat(boss.difficulty ?? 1)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* CTA */}
            {!isEnded && boss.kingdom && (
              <Button
                variant="danger"
                size="sm"
                className="shrink-0 self-center"
                onClick={() => navigate(`/armies?missionType=attack&targetRealm=${boss.kingdom!.realm}&targetRegion=${boss.kingdom!.region}&targetSlot=${boss.kingdom!.slot}`)}
              >
                <Swords size={12} />
                Atacar
              </Button>
            )}
          </div>
        ) : (
          <p className="font-body text-sm text-ink-muted/60 italic">Sin jefe de temporada configurado.</p>
        )}
      </div>
    </Card>
  )
}
