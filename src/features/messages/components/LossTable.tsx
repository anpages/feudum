export function LossTable({ title, losses }: { title: string; losses: Record<string, number> }) {
  const entries = Object.entries(losses).filter(([, v]) => v > 0)
  if (entries.length === 0) return null
  return (
    <div>
      <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
        {title}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
        {entries.map(([unit, count]) => (
          <div key={unit} className="flex items-center justify-between gap-2 font-body text-xs">
            <span className="text-ink-muted capitalize">
              {unit.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <span className="text-ink tabular-nums">{count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
