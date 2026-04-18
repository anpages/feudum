import { Zap } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAdminFleet, useFastForward } from '@/features/admin/useAdmin'
import { formatDuration } from '@/lib/format'

export function MissionsTab() {
  const { data, isLoading } = useAdminFleet()
  const fastForward = useFastForward()

  if (isLoading) return <div className="skeleton h-64 rounded-xl" />

  const missions = data?.missions ?? []
  const now = data?.now ?? 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-ui text-xs text-ink-muted">
          {missions.length} misión{missions.length !== 1 ? 'es' : ''} activa{missions.length !== 1 ? 's' : ''}
        </p>
        {missions.length > 0 && (
          <Button variant="danger" size="sm" onClick={() => fastForward.mutate({ all: true })} disabled={fastForward.isPending}>
            <Zap size={12} /> Completar todas
          </Button>
        )}
      </div>

      {missions.length === 0 && (
        <Card className="p-8 text-center">
          <p className="font-body text-sm text-ink-muted">Sin misiones activas</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {missions.map((m: any) => {
          const arrival   = m.arrivalTime - now
          const returning = m.returnTime ? m.returnTime - now : null
          return (
            <Card key={m.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-ui text-sm font-semibold text-ink truncate">
                    {m.username ?? `#${m.userId}`}
                  </p>
                  <Badge variant="stone">{m.missionType}</Badge>
                  <Badge variant={m.state === 'traveling' ? 'gold' : 'forest'}>{m.state}</Badge>
                </div>
                <p className="font-body text-[11px] text-ink-muted">
                  → R{m.targetRealm}·{m.targetRegion}·{m.targetSlot}
                  {' · '}
                  {arrival > 0 ? `llega en ${formatDuration(arrival)}` : 'en destino'}
                  {returning !== null && returning > 0 && ` · regresa en ${formatDuration(returning)}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => fastForward.mutate({ missionId: m.id })} disabled={fastForward.isPending}>
                <Zap size={12} /> Skip
              </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
