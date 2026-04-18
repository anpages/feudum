import { User } from 'lucide-react'

export function PlayerMessageDetail({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-ui text-ink-muted">
        <User size={12} />
        <span>
          De: <strong className="text-ink">{(data.fromUsername as string) ?? '—'}</strong>
        </span>
      </div>
      <p className="font-body text-sm text-ink leading-relaxed whitespace-pre-wrap">
        {(data.body as string) ?? ''}
      </p>
    </div>
  )
}
