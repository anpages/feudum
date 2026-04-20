import { useState, useEffect } from 'react'
import { Save, Loader2, Zap, Info } from 'lucide-react'
import { GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useResourceSettings, useUpdateResourceSettings, type ResourceSettings } from './useResources'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { formatResource } from '@/lib/format'

const MINES = [
  { key: 'sawmillPercent',   label: 'Aserradero',      icon: <GiWoodPile size={16} />,  color: 'text-forest-light' },
  { key: 'quarryPercent',    label: 'Cantera',         icon: <GiStoneBlock size={16} />, color: 'text-ink-muted'   },
  { key: 'grainFarmPercent', label: 'Granja de Grano', icon: <GiWheat size={16} />,     color: 'text-gold'        },
] as const

const ENERGY = [
  { key: 'windmillPercent',  label: 'Molino de Viento', building: 'windmill'  },
  { key: 'cathedralPercent', label: 'Catedral',         building: 'cathedral' },
] as const

export function ResourceSettingsPage() {
  const { data: kingdom } = useKingdom()
  const { data: settings, isLoading } = useResourceSettings()
  const update = useUpdateResourceSettings()
  const k = kingdom as Record<string, unknown> | null | undefined

  const [draft, setDraft] = useState<ResourceSettings>({
    sawmillPercent: 10, quarryPercent: 10, grainFarmPercent: 10,
    windmillPercent: 10, cathedralPercent: 10,
  })

  useEffect(() => {
    if (!settings) return
    const id = setTimeout(() => setDraft(settings), 0)
    return () => clearTimeout(id)
  }, [settings])

  function setValue(key: keyof ResourceSettings, raw: number) {
    setDraft(d => ({ ...d, [key]: Math.max(0, Math.min(10, raw)) }))
  }

  const hasWindmill  = (k?.windmill  as number ?? 0) > 0
  const hasCathedral = (k?.cathedral as number ?? 0) > 0
  const hasEnergy    = hasWindmill || hasCathedral

  const energyProduced = (k?.energyProduced as number | undefined) ?? 0
  const energyConsumed = (k?.energyConsumed as number | undefined) ?? 0
  const energyOk = energyProduced >= energyConsumed

  if (isLoading) return <SettingsSkeleton />

  return (
    <div className="space-y-6">
      <div className="anim-fade-up">
        <span className="section-heading">Recursos</span>
        <h1 className="page-title mt-0.5">Ajustes de producción</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Regula el porcentaje de actividad de cada edificio. Reducir la producción también reduce el consumo de energía.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-6 items-start">

        {/* ── Left: sliders ── */}
        <div className="space-y-4">
          <Card className="p-5 space-y-5 anim-fade-up-1">
            <h2 className="font-ui text-xs text-ink-muted/60 uppercase tracking-widest">Minas de recursos</h2>
            {MINES.map(({ key, label, icon, color }) => (
              <PercentRow
                key={key}
                label={label}
                icon={<span className={color}>{icon}</span>}
                value={draft[key]}
                onChange={v => setValue(key, v)}
                disabled={update.isPending}
              />
            ))}
          </Card>

          {hasEnergy && (
            <Card className="p-5 space-y-5 anim-fade-up-2">
              <h2 className="font-ui text-xs text-ink-muted/60 uppercase tracking-widest">Edificios de energía</h2>
              {ENERGY.map(({ key, label, building }) => {
                const lv = (k?.[building] as number ?? 0)
                if (lv === 0) return null
                return (
                  <PercentRow
                    key={key}
                    label={label}
                    icon={<Zap size={16} className="text-gold" />}
                    value={draft[key]}
                    onChange={v => setValue(key, v)}
                    disabled={update.isPending}
                  />
                )
              })}
            </Card>
          )}

          <Button
            variant="primary"
            onClick={() => update.mutateAsync(draft)}
            disabled={update.isPending}
            className="w-full anim-fade-up-3"
          >
            {update.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {update.isPending ? 'Guardando…' : 'Guardar ajustes'}
          </Button>
        </div>

        {/* ── Right: info panel ── */}
        <div className="space-y-4 anim-fade-up-2">
          {/* Energy balance */}
          {hasEnergy && (
            <Card className="p-5 space-y-3">
              <h3 className="font-ui text-xs text-ink-muted/60 uppercase tracking-widest">Balance de energía actual</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-body text-ink-muted">Producida</span>
                  <span className="font-ui tabular-nums text-forest-light font-semibold">+{formatResource(energyProduced)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-body text-ink-muted">Consumida</span>
                  <span className="font-ui tabular-nums text-ink-mid font-semibold">−{formatResource(energyConsumed)}</span>
                </div>
                <div className="divider">◆</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-body text-ink font-semibold">Balance</span>
                  <span className={`font-ui tabular-nums font-bold ${energyOk ? 'text-forest-light' : 'text-crimson'}`}>
                    {energyOk ? '+' : ''}{formatResource(energyProduced - energyConsumed)}
                  </span>
                </div>
              </div>
              {!energyOk && (
                <div className="flex items-start gap-2 mt-1 p-2.5 rounded bg-crimson/5 border border-crimson/20">
                  <Zap size={12} className="text-crimson shrink-0 mt-0.5" />
                  <p className="font-body text-xs text-crimson leading-relaxed">
                    Déficit de energía — la producción está al {Math.round(energyProduced / energyConsumed * 100)}% de su capacidad.
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* How it works */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Info size={13} className="text-gold-dim" />
              <h3 className="font-ui text-xs text-ink-muted/60 uppercase tracking-widest">Cómo funciona</h3>
            </div>
            <div className="space-y-2.5 font-body text-xs text-ink-muted leading-relaxed">
              <p>
                Cada slider controla el porcentaje de actividad del edificio (0% apagado — 100% máximo rendimiento).
              </p>
              <p>
                Reducir una mina al 50% reduce su producción a la mitad, <strong className="text-ink">y también su consumo de energía</strong> a la mitad.
              </p>
              <p>
                Si las minas consumen más energía de la que el Molino y la Catedral producen, el juego reduce automáticamente la producción de todas las minas proporcionalmente.
              </p>
              <p className="text-ink-muted/60 italic">
                Tip: apaga las minas menos rentables para eliminar su consumo energético y dejar toda la energía disponible para las que más producen.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PercentRow({
  label, icon, value, onChange, disabled,
}: {
  label: string
  icon: React.ReactNode
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const pct = value * 10

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-ui text-sm text-ink">{label}</span>
        </div>
        <span className="font-ui text-sm tabular-nums font-semibold text-gold-dim">{pct}%</span>
      </div>
      <input
        type="range"
        min={0} max={10} step={1}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="w-full h-1.5 appearance-none bg-gold/20 rounded-full cursor-pointer accent-gold"
      />
      <div className="flex justify-between font-ui text-[0.6rem] text-ink-muted/40">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-16" />
        <div className="skeleton h-8 w-48" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <Card className="p-5 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-2 w-full rounded-full" />
            </div>
          ))}
        </Card>
        <div className="space-y-4">
          <div className="skeleton h-36 rounded-lg" />
          <div className="skeleton h-48 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
