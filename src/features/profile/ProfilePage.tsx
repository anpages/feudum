import { useState, useEffect } from 'react'
import { User, Mail, Calendar, Save, Loader2 } from 'lucide-react'
import { GiCastle } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useProfile, useUpdateProfile } from '@/features/profile/useProfile'
import { useKingdom } from '@/features/kingdom/useKingdom'

export function ProfilePage() {
  const { data: profile, isLoading } = useProfile()
  const { data: kingdom } = useKingdom()
  const update = useUpdateProfile()

  const [username, setUsername] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile?.username) return
    const id = setTimeout(() => setUsername(profile.username ?? ''), 0)
    return () => clearTimeout(id)
  }, [profile?.username])

  async function handleSave() {
    if (!username.trim()) return
    await update.mutateAsync(username.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (isLoading) return <ProfileSkeleton />

  const joinDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('es', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'

  return (
    <div className="space-y-8 max-w-lg">
      <div className="anim-fade-up">
        <span className="section-heading">Cuenta</span>
        <h1 className="page-title mt-0.5">Perfil</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Gestiona tu nombre de usuario y consulta la información de tu cuenta.
        </p>
      </div>

      {/* Kingdom summary */}
      {kingdom && (
        <Card className="p-5 flex items-center gap-4 anim-fade-up-1">
          <div className="w-12 h-12 rounded-xl bg-gold-soft border border-gold/20 flex items-center justify-center shrink-0">
            <GiCastle size={24} className="text-gold-dim" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-ui text-base font-semibold text-ink truncate">{kingdom.name}</p>
            <p className="font-body text-xs text-ink-muted mt-0.5">
              Reino {kingdom.realm} · Región {kingdom.region} · Posición {kingdom.slot}
            </p>
          </div>
          <Badge variant="gold">Tu reino</Badge>
        </Card>
      )}

      {/* Edit username */}
      <Card className="p-5 space-y-4 anim-fade-up-2">
        <h2 className="font-ui text-sm font-semibold text-ink uppercase tracking-widest">
          Nombre de usuario
        </h2>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-parchment border border-gold/20 flex items-center justify-center shrink-0">
            <User size={14} className="text-ink-muted" />
          </div>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            maxLength={20}
            placeholder="nombre_usuario"
            className="game-input flex-1"
          />
        </div>

        <p className="font-body text-xs text-ink-muted/70">
          3–20 caracteres, solo letras, números y guiones bajos.
        </p>

        {update.isError && (
          <p className="font-ui text-xs text-crimson">
            {(update.error as Error)?.message ?? 'Error al guardar'}
          </p>
        )}

        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!username.trim() || update.isPending}
          className="w-full"
        >
          {update.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : saved ? (
            '✓ Guardado'
          ) : (
            <Save size={12} />
          )}
          {update.isPending ? 'Guardando…' : saved ? '' : 'Guardar cambios'}
        </Button>
      </Card>

      {/* Account info (read-only) */}
      <Card className="p-5 space-y-3 anim-fade-up-3">
        <h2 className="font-ui text-sm font-semibold text-ink uppercase tracking-widest">
          Información de cuenta
        </h2>

        <div className="space-y-3">
          <InfoRow
            icon={<Mail size={13} />}
            label="Correo electrónico"
            value={profile?.email ?? '—'}
          />
          <InfoRow icon={<Calendar size={13} />} label="Fecha de registro" value={joinDate} />
        </div>
      </Card>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-ink-muted/60 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-ui text-[0.6rem] text-ink-muted/60 uppercase tracking-widest">{label}</p>
        <p className="font-body text-sm text-ink truncate mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-8 max-w-lg">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-16" />
        <div className="skeleton h-8 w-32" />
      </div>
      <Card className="p-5 flex items-center gap-4">
        <div className="skeleton w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-3 w-28" />
        </div>
      </Card>
      <Card className="p-5 space-y-4">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton h-9 w-full rounded" />
        <div className="skeleton h-8 w-full rounded" />
      </Card>
    </div>
  )
}
