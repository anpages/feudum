import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAdminSettings, useUpdateSettings, type AdminSettings } from '@/features/admin/useAdmin'

const SETTINGS_META: { key: keyof AdminSettings; label: string; hint: string; integer?: boolean }[] = [
  { key: 'economy_speed',        label: 'Velocidad economía',       hint: 'Producción y construcción' },
  { key: 'research_speed',       label: 'Velocidad investigación',  hint: 'Tiempo de laboratorio' },
  { key: 'fleet_speed_war',      label: 'Flota (guerra)',           hint: 'Ataque, pillaje, espionaje' },
  { key: 'fleet_speed_peaceful', label: 'Flota (paz)',              hint: 'Transporte, colonización' },
  { key: 'basic_wood',           label: 'Madera base / h',          hint: 'Sin edificios', integer: true },
  { key: 'basic_stone',          label: 'Piedra base / h',          hint: 'Sin edificios', integer: true },
]

export function ServerTab() {
  const { data, isLoading } = useAdminSettings()
  const update = useUpdateSettings()
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)

  if (isLoading) return <div className="skeleton h-64 rounded-xl" />

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
  )
}
