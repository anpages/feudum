import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAdminUsers, useToggleAdmin, type AdminUser } from '@/features/admin/useAdmin'

export function PlayersTab() {
  const { data, isLoading } = useAdminUsers()
  const toggle = useToggleAdmin()

  if (isLoading) return <div className="skeleton h-64 rounded-xl" />

  const users = (data?.users ?? []).filter((u: AdminUser) => !u.isNpc)

  return (
    <Card className="divide-y divide-gold/10">
      {users.length === 0 && (
        <p className="p-5 font-body text-sm text-ink-muted text-center">Sin jugadores</p>
      )}
      {users.map((u: AdminUser) => (
        <div key={u.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-ui text-sm text-ink font-semibold truncate">
                {u.username ?? <span className="italic text-ink-muted/60 font-normal">sin nickname</span>}
              </p>
              {u.isAdmin && <Badge variant="gold">Admin</Badge>}
            </div>
            <p className="font-body text-[11px] text-ink-muted truncate">{u.email}</p>
            {u.kingdom && (
              <p className="font-body text-[10px] text-ink-muted/50 mt-0.5">
                Reino {u.kingdom.realm}·{u.kingdom.region}·{u.kingdom.slot}
              </p>
            )}
          </div>
          <Button
            variant={u.isAdmin ? 'danger' : 'ghost'}
            size="sm"
            onClick={() => toggle.mutate({ userId: u.id, isAdmin: !u.isAdmin })}
            disabled={toggle.isPending}
          >
            {u.isAdmin ? 'Quitar admin' : 'Hacer admin'}
          </Button>
        </div>
      ))}
    </Card>
  )
}
