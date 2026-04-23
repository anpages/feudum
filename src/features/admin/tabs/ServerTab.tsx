import { useState } from 'react'
import { Loader2, Save, Crown, Skull, Swords } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAdminSettings, useUpdateSettings, type AdminSettings } from '@/features/admin/useAdmin'
import { useSeason, useAdminStartSeason, useAdminEndSeason, useAdminCleanSessionData } from '@/features/season/useSeason'
import { formatDuration } from '@/lib/format'
import { useNow } from '@/lib/useNow'

const SETTINGS_META: { key: keyof AdminSettings; label: string; hint: string; integer?: boolean }[] = [
  { key: 'economy_speed',        label: 'Velocidad economía',       hint: 'Producción y construcción' },
  { key: 'research_speed',       label: 'Velocidad investigación',  hint: 'Tiempo de laboratorio' },
  { key: 'fleet_speed_war',      label: 'Flota (guerra)',           hint: 'Ataque, pillaje, espionaje' },
  { key: 'fleet_speed_peaceful', label: 'Flota (paz)',              hint: 'Transporte, colonización' },
  { key: 'basic_wood',           label: 'Madera base / h',          hint: 'Sin edificios', integer: true },
  { key: 'basic_stone',          label: 'Piedra base / h',          hint: 'Sin edificios', integer: true },
]

function SeasonSection() {
  const { data: season, isLoading } = useSeason()
  const startSeason = useAdminStartSeason()
  const endSeason   = useAdminEndSeason()
  const cleanData   = useAdminCleanSessionData()
  const [confirm, setConfirm] = useState<'start' | 'end' | 'clean' | null>(null)
  const now = useNow()

  if (isLoading) return <div className="skeleton h-36 rounded-xl" />

  const timeLeft = season?.seasonEnd ? Math.max(0, season.seasonEnd - now) : 0

  async function handleStart() {
    try {
      await startSeason.mutateAsync()
      setConfirm(null)
    } catch {
      // error shown via startSeason.error below
    }
  }

  async function handleEnd() {
    try {
      await endSeason.mutateAsync({ condition: 'admin_forced' })
      setConfirm(null)
    } catch {
      // error shown via endSeason.error below
    }
  }

  return (
    <div className="space-y-3">
      <span className="section-heading">Temporada</span>

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
            <div className="flex flex-wrap gap-4 mt-2">
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

      {(startSeason.error || endSeason.error) && (
        <p className="font-ui text-xs text-crimson-light bg-crimson/5 border border-crimson/20 rounded-lg px-3 py-2">
          {String((startSeason.error || endSeason.error) ?? 'Error desconocido')}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Limpiar combates + éter (sin tocar reinos) */}
        {confirm === 'clean' ? (
          <div className="flex items-center gap-2">
            <span className="font-body text-xs text-ink-muted">¿Limpiar combates y éter?</span>
            <Button variant="danger" size="sm" onClick={async () => { await cleanData.mutateAsync(); setConfirm(null) }} disabled={cleanData.isPending}>
              {cleanData.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
              Confirmar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>Cancelar</Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirm('clean')}>
            Limpiar combates + éter
          </Button>
        )}

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

export function ServerTab() {
  const { data, isLoading } = useAdminSettings()
  const update = useUpdateSettings()
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)

  async function saveField(key: keyof AdminSettings) {
    const raw = values[key]
    if (raw === undefined) return
    const num = key === 'basic_wood' || key === 'basic_stone' ? parseInt(raw, 10) : parseFloat(raw)
    if (isNaN(num) || num < 0) return
    await update.mutateAsync({ [key]: num } as Partial<AdminSettings>)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  function getVal(key: keyof AdminSettings) {
    return values[key] !== undefined ? values[key] : String(data?.[key] ?? '')
  }

  return (
    <div className="space-y-8">
      <SeasonSection />

      <div className="space-y-3">
        <span className="section-heading">Configuración del servidor</span>
        {isLoading ? (
          <div className="skeleton h-64 rounded-xl" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {SETTINGS_META.map(({ key, label, hint, integer }) => (
              <Card key={key} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-sm font-semibold text-ink">{label}</p>
                  <p className="font-body text-[11px] text-ink-muted/70 mt-0.5">{hint}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    inputMode={integer ? 'numeric' : 'decimal'}
                    value={getVal(key)}
                    onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveField(key)}
                    className="game-input w-24 text-center text-sm tabular-nums"
                  />
                  <Button
                    variant={saved === key ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => saveField(key)}
                    disabled={update.isPending || values[key] === undefined}
                  >
                    {update.isPending && saved !== key
                      ? <Loader2 size={12} className="animate-spin" />
                      : <Save size={12} />}
                    {saved === key ? '✓' : 'OK'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
