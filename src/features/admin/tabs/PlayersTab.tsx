import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAdminUsers, useToggleAdmin, useDeleteUser, useAddNpc } from '@/features/admin/useAdmin'
import { adminService } from '../services/adminService'
import { KingdomProfile } from './NpcProfileTab'
import type { AdminUser } from '@/features/admin/types'

type Coords = { realm: number; region: number; slot: number; username: string | null; isNpc: boolean }
type ConfirmState =
  | { type: 'delete_npc';   user: AdminUser }
  | { type: 'delete_human'; user: AdminUser }
  | { type: 'add_npc' }
  | null

export function PlayersTab() {
  const { data, isLoading } = useAdminUsers()
  const toggle     = useToggleAdmin()
  const deleteUser = useDeleteUser()
  const [newNpcId, setNewNpcId] = useState<string | null>(null)
  const addNpc = useAddNpc((id) => {
    setNewNpcId(id)
    setTimeout(() => setNewNpcId(null), 8000)
  })
  const [selected, setSelected]   = useState<Coords | null>(null)
  const [confirm,  setConfirm]    = useState<ConfirmState>(null)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['admin', 'npc-profile', selected?.realm, selected?.region, selected?.slot],
    queryFn: () => adminService.getNpcProfile(selected!.realm, selected!.region, selected!.slot),
    enabled: !!selected,
    refetchInterval: 15_000,
  })

  if (isLoading) return <div className="skeleton h-64 rounded-xl" />

  const users = data?.users ?? []
  const humans = users.filter((u: AdminUser) => !u.isNpc)
  const npcs   = users.filter((u: AdminUser) =>  u.isNpc)

  function handleConfirm() {
    if (!confirm) return
    if (confirm.type === 'delete_npc' || confirm.type === 'delete_human') {
      deleteUser.mutate(confirm.user.id, { onSuccess: () => setConfirm(null) })
    } else if (confirm.type === 'add_npc') {
      addNpc.mutate(undefined, { onSuccess: () => setConfirm(null) })
    }
  }

  const isPending = deleteUser.isPending || addNpc.isPending

  // ── Profile view ────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 font-ui text-xs text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft size={13} /> Volver a la lista
        </button>

        {profileLoading && (
          <div className="space-y-3">
            <div className="skeleton h-32 rounded-lg" />
            <div className="skeleton h-20 rounded-lg" />
            <div className="grid grid-cols-2 gap-4">
              <div className="skeleton h-64 rounded-lg" />
              <div className="skeleton h-64 rounded-lg" />
            </div>
          </div>
        )}

        {profile && !profileLoading && (
          <KingdomProfile
            kingdom={profile.kingdom}
            personality={profile.personality}
            npcClass={profile.npcClass}
            virtualResearch={profile.virtualResearch}
            research={profile.research}
            points={profile.points}
            activeMissions={profile.activeMissions}
            recentMissions={profile.recentMissions}
            battles={profile.battles}
            now={now}
          />
        )}
      </div>
    )
  }

  // ── List view ───────────────────────────────────────────────────────────
  function UserRow({ u }: { u: AdminUser }) {
    const canSeeProfile = !!u.kingdom
    const isNew = u.id === newNpcId
    return (
      <div className={`flex items-center gap-3 px-4 py-3 transition-colors ${isNew ? 'bg-forest/10 ring-1 ring-inset ring-forest/30' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-ui text-sm text-ink font-semibold truncate">
              {u.username ?? <span className="italic text-ink-muted/60 font-normal">sin nickname</span>}
            </p>
            {u.role === 'admin' && <Badge variant="gold">Admin</Badge>}
            {u.isNpc && <Badge variant="stone">NPC</Badge>}
            {isNew && <Badge variant="forest" className="text-[0.6rem]">Nuevo</Badge>}
          </div>
          {!u.isNpc && <p className="font-body text-[11px] text-ink-muted truncate">{u.email}</p>}
          {u.kingdom && (
            <p className="font-body text-[10px] text-ink-muted/50 mt-0.5">
              {u.kingdom.realm}·{u.kingdom.region}·{u.kingdom.slot}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!u.isNpc && (
            <Button
              variant={u.role === 'admin' ? 'danger' : 'ghost'}
              size="sm"
              onClick={() => toggle.mutate({ userId: u.id, isAdmin: u.role !== 'admin' })}
              disabled={toggle.isPending}
            >
              {u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={!canSeeProfile}
            onClick={() => u.kingdom && setSelected({
              realm: u.kingdom.realm, region: u.kingdom.region, slot: u.kingdom.slot,
              username: u.username, isNpc: u.isNpc,
            })}
          >
            Ver perfil
          </Button>
          {!u.isNpc && u.role !== 'admin' && (
            <Button variant="danger" size="sm" onClick={() => setConfirm({ type: 'delete_human', user: u })}>
              Borrar
            </Button>
          )}
          {u.isNpc && (
            <Button variant="danger" size="sm" onClick={() => setConfirm({ type: 'delete_npc', user: u })}>
              Eliminar
            </Button>
          )}
        </div>
      </div>
    )
  }

  const confirmProps = confirm === null ? null : confirm.type === 'add_npc' ? {
    title: 'Añadir NPC',
    message: 'Se creará un nuevo NPC en un slot vacío aleatorio. Comenzará desde cero.',
    confirmLabel: 'Añadir',
    danger: false,
  } : confirm.type === 'delete_npc' ? {
    title: 'Eliminar NPC',
    message: `¿Eliminar a "${confirm.user.username}"? Se borrarán todos sus datos de la base de datos.`,
    confirmLabel: 'Eliminar',
    danger: true,
  } : {
    title: 'Borrar cuenta',
    message: `¿Borrar la cuenta de "${confirm.user.username ?? confirm.user.email}"? Esta acción es irreversible.`,
    confirmLabel: 'Borrar',
    danger: true,
  }

  return (
    <>
      <div className="space-y-4">
        {/* Jugadores humanos */}
        <div>
          <p className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted mb-2">
            Jugadores ({humans.length})
          </p>
          <Card className="divide-y divide-gold/10">
            {humans.length === 0 && (
              <p className="p-5 font-body text-sm text-ink-muted text-center">Sin jugadores</p>
            )}
            {humans.map((u: AdminUser) => <UserRow key={u.id} u={u} />)}
          </Card>
        </div>

        {/* NPCs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-ui text-[0.6rem] uppercase tracking-widest text-ink-muted">
              NPCs ({npcs.length})
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={addNpc.isPending}
              onClick={() => setConfirm({ type: 'add_npc' })}
            >
              + Añadir NPC
            </Button>
          </div>
          {addNpc.isError && (
            <p className="font-ui text-xs text-crimson-light mb-2">
              {addNpc.error instanceof Error && addNpc.error.message.includes('no_empty_slots')
                ? 'No hay slots vacíos disponibles'
                : 'Error al añadir NPC'}
            </p>
          )}
          <Card className="divide-y divide-gold/10">
            {npcs.length === 0 && (
              <p className="p-5 font-body text-sm text-ink-muted text-center">Sin NPCs</p>
            )}
            {npcs.map((u: AdminUser) => <UserRow key={u.id} u={u} />)}
          </Card>
        </div>
      </div>

      {confirmProps && (
        <ConfirmDialog
          open={confirm !== null}
          onClose={() => !isPending && setConfirm(null)}
          onConfirm={handleConfirm}
          loading={isPending}
          {...confirmProps}
        />
      )}
    </>
  )
}
