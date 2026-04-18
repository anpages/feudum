import type { ReactNode } from 'react'
import { formatResource } from '@/lib/format'

export function ResourcePill({ icon, label, value, cap, rate }: {
  icon: ReactNode
  label: string
  value: number
  cap?: number
  rate?: number
}) {
  const isFull = cap !== undefined && value >= cap

  return (
    <div
      className="resource-pill !px-1.5 sm:!px-2"
      title={`${label}: ${formatResource(value)}${cap ? ` / ${formatResource(cap)}` : ''}${rate ? ` (+${formatResource(rate)}/h)` : ''}`}
    >
      <span className={isFull ? 'text-crimson' : 'text-gold'}>{icon}</span>
      <span className={`font-ui text-xs tabular-nums font-medium ${isFull ? 'text-crimson' : 'text-ink-mid'}`}>
        {formatResource(value)}
      </span>
      {rate !== undefined && rate > 0 && (
        <span className="hidden lg:inline font-ui text-[0.6rem] tabular-nums text-forest-light">
          +{formatResource(rate)}/h
        </span>
      )}
    </div>
  )
}
