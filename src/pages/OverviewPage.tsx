import { useKingdom } from '@/hooks/useKingdom'

export function OverviewPage() {
  const { data: kingdom, isLoading } = useKingdom()

  if (isLoading) return <div className="text-stone-400">Cargando reino…</div>

  return (
    <div>
      <h1 className="text-2xl font-display text-gold mb-4">
        {kingdom?.name ?? 'Mi Reino'}
      </h1>
      <p className="text-stone-400">Vista general del reino — en construcción.</p>
    </div>
  )
}
