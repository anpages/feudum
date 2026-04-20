import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Zap, TreePine, Mountain, Wheat } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useResourceSettings, useUpdateResourceSettings, type ResourceSettings } from './useResources'
import { useKingdom } from '@/features/kingdom/useKingdom'
import { useResearch } from '@/features/research/useResearch'
import { formatResource } from '@/lib/format'
import { effectiveProduction } from '@/lib/game/production'

const MINES = [
  { key: 'sawmillPercent',   label: 'Aserradero',      icon: <TreePine  size={16} className="text-forest-light" /> },
  { key: 'quarryPercent',    label: 'Cantera',         icon: <Mountain  size={16} className="text-parchment-dim" /> },
  { key: 'grainFarmPercent', label: 'Granja de Grano', icon: <Wheat     size={16} className="text-gold"          /> },
] as const

export function ResourceSettingsPage() {
  const navigate = useNavigate()
  const { data: kingdom } = useKingdom()
  const { data: settings, isLoading } = useResourceSettings()
  const { data: researchData } = useResearch()
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

  // Live preview using draft percents
  const preview = useMemo(() => {
    if (!kingdom) return null
    const draftKingdom = { ...kingdom, ...draft }
    const res = researchData?.research ? Object.fromEntries(researchData.research.map((r: { id: string; level: number }) => [r.id, r.level])) : {}
    return effectiveProduction(draftKingdom, res, { economy_speed: 1 })
  }, [kingdom, draft, researchData])

  // Current production with saved settings
  const current = useMemo(() => {
    if (!kingdom) return null
    const res = researchData?.research ? Object.fromEntries(researchData.research.map((r: { id: string; level: number }) => [r.id, r.level])) : {}
    return effectiveProduction(kingdom, res, { economy_speed: 1 })
  }, [kingdom, researchData])

  const energyOk   = (preview?.energyProd ?? 0) >= (preview?.energyCons ?? 0)
  const energyCons = preview?.energyCons ?? 0
  const energyProd = preview?.energyProd ?? 0

  if (isLoading) return <SettingsSkeleton />

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="anim-fade-up">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 font-ui text-xs text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft size={13} />
          Volver
        </button>
        <span className="section-heading">Recursos</span>
        <h1 className="page-title mt-0.5">Ajustes de producción</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Regula el porcentaje de actividad de cada mina. Reducirla también reduce su consumo energético.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-6 items-start">

        {/* ── Left: sliders ── */}
        <div className="space-y-4">
          <Card className="p-5 space-y-6 anim-fade-up-1">
            {MINES.map(({ key, label, icon }) => (
              <PercentRow
                key={key}
                label={label}
                icon={icon}
                value={draft[key]}
                onChange={v => setValue(key, v)}
                disabled={update.isPending}
              />
            ))}
          </Card>

          <Button
            variant="primary"
            onClick={() => update.mutateAsync(draft)}
            disabled={update.isPending}
            className="w-full anim-fade-up-2"
          >
            {update.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {update.isPending ? 'Guardando…' : 'Guardar ajustes'}
          </Button>
        </div>

        {/* ── Right: live preview ── */}
        <div className="space-y-4 anim-fade-up-2">

          {/* Production preview */}
          {preview && (
            <Card className="p-5 space-y-3">
              <h3 className="font-ui text-xs text-ink-muted/60 uppercase tracking-widest">Producción estimada / h</h3>
              <div className="space-y-2.5">
                <PreviewRow
                  icon={<TreePine size={12} className="text-forest-light" />}
                  label="Madera"
                  current={current?.wood ?? 0}
                  preview={preview.wood}
                  color="text-forest-light"
                />
                <PreviewRow
                  icon={<Mountain size={12} className="text-parchment-dim" />}
                  label="Piedra"
                  current={current?.stone ?? 0}
                  preview={preview.stone}
                  color="text-parchment-dim"
                />
                <PreviewRow
                  icon={<Wheat size={12} className="text-gold-dim" />}
                  label="Grano"
                  current={current?.grain ?? 0}
                  preview={preview.grain}
                  color="text-gold-dim"
                />
              </div>

              {/* Energy balance */}
              {(energyProd > 0 || energyCons > 0) && (
                <>
                  <div className="divider">◆</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-body text-ink-muted flex items-center gap-1"><Zap size={10} />Energía prod.</span>
                      <span className="font-ui tabular-nums text-forest-light">+{formatResource(energyProd)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-body text-ink-muted flex items-center gap-1"><Zap size={10} />Energía cons.</span>
                      <span className="font-ui tabular-nums text-ink-mid">−{formatResource(energyCons)}</span>
                    </div>
                    {!energyOk && energyCons > 0 && (
                      <p className="font-body text-[0.65rem] text-crimson mt-1">
                        Déficit — producción al {Math.round(energyProd / energyCons * 100)}%
                      </p>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

          {/* Tip */}
          <Card className="p-4 space-y-1.5">
            <p className="font-ui text-xs font-semibold text-ink-muted/60 uppercase tracking-widest">Tip</p>
            <p className="font-body text-xs text-ink-muted/70 leading-relaxed">
              Si te falta energía, baja las minas menos rentables al 0% en vez de dejar que el juego las reduzca todas a la vez. Así concentras la energía donde más produce.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Preview row ───────────────────────────────────────────────────────────────

function PreviewRow({ icon, label, current, preview, color }: {
  icon: React.ReactNode
  label: string
  current: number
  preview: number
  color: string
}) {
  const diff = preview - current
  const changed = Math.abs(diff) > 0.5
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="font-body text-xs text-ink-muted flex-1">{label}</span>
      <span className={`font-ui text-sm tabular-nums font-semibold ${color}`}>
        {formatResource(preview)}/h
      </span>
      {changed && (
        <span className={`font-ui text-[0.6rem] tabular-nums ${diff > 0 ? 'text-forest-light' : 'text-crimson'}`}>
          {diff > 0 ? '▲' : '▼'}{formatResource(Math.abs(diff))}
        </span>
      )}
    </div>
  )
}

// ── Slider row ────────────────────────────────────────────────────────────────

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
    <div className="space-y-2">
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
        className="w-full h-1.5 appearance-none rounded-full cursor-pointer accent-gold"
        style={{ background: `linear-gradient(to right, var(--color-gold) ${pct}%, color-mix(in srgb, var(--color-gold) 20%, transparent) ${pct}%)` }}
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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card className="p-5 space-y-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-2 w-full rounded-full" />
            </div>
          ))}
        </Card>
        <div className="space-y-4">
          <div className="skeleton h-40 rounded-lg" />
          <div className="skeleton h-24 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
