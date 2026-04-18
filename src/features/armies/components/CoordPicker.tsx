import { ChevronLeft, ChevronRight } from 'lucide-react'

export function CoordPicker({ label, value, min, max, onChange }: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="section-heading mb-0 text-[0.58rem]">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={11} />
        </button>
        <span className="font-ui font-semibold text-ink w-6 text-center tabular-nums text-sm">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="p-1 rounded border border-gold/20 text-ink-muted hover:bg-parchment-warm disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={11} />
        </button>
      </div>
    </div>
  )
}
