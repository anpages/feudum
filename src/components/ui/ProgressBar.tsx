import { cn } from '@/lib/cn'

interface ProgressBarProps {
  value: number
  max: number
  className?: string
}

export function ProgressBar({ value, max, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className={cn('progress-track', className)}>
      <div className={cn('progress-fill', pct >= 100 && 'full')} style={{ width: `${pct}%` }} />
    </div>
  )
}
