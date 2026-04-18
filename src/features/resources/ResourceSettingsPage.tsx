import { useState, useEffect } from 'react'
import { Save, Loader2, Zap } from 'lucide-react'
import { GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useResourceSettings, useUpdateResourceSettings, type ResourceSettings } from './useResources'
import { useKingdom } from '@/features/kingdom/useKingdom'

const MINES = [
  { key: 'sawmillPercent',   label: 'Aserradero',      icon: <GiWoodPile size={16} />,  color: 'text-forest-light' },
  { key: 'quarryPercent',    label: 'Cantera',         icon: <GiStoneBlock size={16} />, color: 'text-ink-muted'   },
  { key: 'grainFarmPercent', label: 'Granja de Grano', icon: <GiWheat size={16} />,     color: 'text-gold'        },
] as const

const ENERGY = [
  { key: 'windmillPercent',  label: 'Molino de Viento', icon: <Zap size={16} />, color: 'text-gold'    },
  { key: 'cathedralPercent', label: 'Catedral',         icon: <Zap size={16} />, color: 'text-gold-dim' },
] as const

export function ResourceSettingsPage() {
  const { data: kingdom } = useKingdom()
  const { data: settings, isLoading } = useResourceSettings()
  const update = useUpdateResourceSettings()

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

  async function handleSave() {
    await update.mutateAsync(draft)
  }

  if (isLoading) return <SettingsSkeleton />

  return (
    <div className="space-y-6 max-w-lg">
      <div className="anim-fade-up">
        <span className="section-heading">Recursos</span>
        <h1 className="page-title mt-0.5">Ajustes de producción</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Regula el porcentaje de actividad de cada edificio. Reducir la producción también reduce el consumo de energía.
        </p>
      </div>

      <Card className="p-5 space-y-4 anim-fade-up-1">
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

      <Card className="p-5 space-y-4 anim-fade-up-2">
        <h2 className="font-ui text-xs text-ink-muted/60 uppercase tracking-widest">Edificios de energía</h2>
        {ENERGY.map(({ key, label, icon, color }) => {
          const building = key === 'windmillPercent' ? 'windmill' : 'cathedral'
          const lv = (kingdom as Record<string, unknown>)?.[building] as number ?? 0
          if (lv === 0) return null
          return (
            <PercentRow
              key={key}
              label={label}
              icon={<span className={color}>{icon}</span>}
              value={draft[key]}
              onChange={v => setValue(key, v)}
              disabled={update.isPending}
            />
          )
        })}
        {(((kingdom as Record<string, unknown>)?.windmill as number ?? 0) === 0 &&
          ((kingdom as Record<string, unknown>)?.cathedral as number ?? 0) === 0) && (
          <p className="font-body text-sm text-ink-muted/50">No tienes edificios de energía construidos.</p>
        )}
      </Card>

      <Button
        variant="primary"
        onClick={handleSave}
        disabled={update.isPending}
        className="w-full anim-fade-up-3"
      >
        {update.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        {update.isPending ? 'Guardando…' : 'Guardar ajustes'}
      </Button>
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
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          disabled={disabled}
          className="flex-1 h-1.5 appearance-none bg-gold/20 rounded-full cursor-pointer accent-gold"
        />
      </div>
      <div className="flex justify-between font-ui text-[0.6rem] text-ink-muted/40">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-16" />
        <div className="skeleton h-8 w-48" />
      </div>
      <Card className="p-5 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-2 w-full rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  )
}
