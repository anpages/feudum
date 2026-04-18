import { formatResource } from '@/lib/format'

export function ResourcePill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5 font-ui text-sm">
      <span className="text-gold/70">{icon}</span>
      <span className="text-ink tabular-nums">{formatResource(value)}</span>
      <span className="text-ink-muted/60 text-xs">{label}</span>
    </div>
  )
}
