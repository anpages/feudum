import { useState } from 'react'
import { Loader2, Crown, Skull, Swords } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useSeason, useAdminStartSeason, useAdminEndSeason } from '@/features/season/useSeason'
import { formatDuration } from '@/lib/format'
import { useNow } from '@/lib/useNow'

export function SeasonTab() {
  const { data: season, isLoading } = useSeason()
  const startSeason = useAdminStartSeason()
  const endSeason   = useAdminEndSeason()
  const [confirm, setConfirm] = useState<'start' | 'end' | null>(null)
  const now = useNow()

  if (isLoading) return <div className="skeleton h-48 rounded-xl" />

  const timeLeft = season?.seasonEnd ? Math.max(0, season.seasonEnd - now) : 0

  async function handleStart() {
    await startSeason.mutateAsync()
    setConfirm(null)
  }

  async function handleEnd() {
    await endSeason.mutateAsync({ condition: 'admin_forced' })
    setConfirm(null)
  }

  return (
    <div className="space-y-4">
      {/* Current season info */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Crown size={18} className="text-gold" />
          <div>
            <h3 className="font-ui text-sm font-semibold text-ink">Estado de temporada</h3>
            {season?.seasonNumber
              ? <p className="font-body text-xs text-ink-muted">Temporada {season.seasonNumber}</p>
              : <p className="font-body text-xs text-ink-muted">Sin temporada activa</p>
            }
          </div>
          {season?.seasonState && (
            <Badge variant={season.seasonState === 'active' ? 'forest' : 'stone'} className="ml-auto">
              {season.seasonState === 'active' ? 'Activa' : 'Finalizada'}
            </Badge>
          )}
        </div>

        {season?.active && season.boss && (
          <div className="bg-obsidian/60 rounded-lg p-3 space-y-1.5 border border-crimson/20">
            <div className="flex items-center gap-2">
              <Swords size={13} className="text-crimson-light" />
              <span className="font-ui text-xs font-semibold text-crimson-light">Jefe Final</span>
            </div>
            <p className="font-body text-sm text-parchment">{season.boss.name}</p>
            <p className="font-body text-xs text-ink-muted/70 italic">{season.boss.lore}</p>
            <div className="flex gap-4 mt-2">
              <div>
                <span className="font-ui text-[0.6rem] text-ink-muted/50 uppercase tracking-wide">Dificultad</span>
                <p className="font-ui text-xs tabular-nums text-gold">{season.boss.difficulty.toFixed(2)}×</p>
              </div>
              {season.boss.kingdom && (
                <div>
                  <span className="font-ui text-[0.6rem] text-ink-muted/50 uppercase tracking-wide">Posición</span>
                  <p className="font-ui text-xs tabular-nums text-ink-mid">
                    R{season.boss.kingdom.realm}·{season.boss.kingdom.region}·{season.boss.kingdom.slot}
                  </p>
                </div>
              )}
              <div>
                <span className="font-ui text-[0.6rem] text-ink-muted/50 uppercase tracking-wide">Caballeros Dragón</span>
                <p className="font-ui text-xs tabular-nums text-crimson-light">{season.boss.kingdom?.dragonKnight ?? 0}</p>
              </div>
              <div>
                <span className="font-ui text-[0.6rem] text-ink-muted/50 uppercase tracking-wide">Tiempo restante</span>
                <p className="font-ui text-xs tabular-nums text-ink-mid">{formatDuration(timeLeft)}</p>
              </div>
            </div>
          </div>
        )}

        {season?.winner && (
          <div className="bg-gold/5 rounded-lg p-3 border border-gold/20">
            <p className="font-ui text-xs text-gold font-semibold">
              🏆 Ganador: {season.winner.username ?? 'Desconocido'}
            </p>
            <p className="font-body text-xs text-ink-muted mt-0.5">
              Condición: {season.winner.condition}
            </p>
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        {!season?.active && (
          confirm === 'start' ? (
            <div className="flex items-center gap-2">
              <span className="font-body text-xs text-ink-muted">¿Iniciar temporada {(season?.seasonNumber ?? 0) + 1}?</span>
              <Button variant="primary" size="sm" onClick={handleStart} disabled={startSeason.isPending}>
                {startSeason.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                Confirmar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setConfirm('start')}>
              <Crown size={13} />
              Iniciar temporada {(season?.seasonNumber ?? 0) + 1}
            </Button>
          )
        )}

        {season?.active && (
          confirm === 'end' ? (
            <div className="flex items-center gap-2">
              <span className="font-body text-xs text-crimson-light">¿Forzar fin de temporada?</span>
              <Button variant="danger" size="sm" onClick={handleEnd} disabled={endSeason.isPending}>
                {endSeason.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                Confirmar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>Cancelar</Button>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirm('end')}>
              <Skull size={13} />
              Forzar fin de temporada
            </Button>
          )
        )}
      </div>
    </div>
  )
}
