import { useState, useEffect } from 'react'
import { User, Mail, Calendar, Save, Loader2, Pencil, Trash2, Zap, LogOut, Bell, BellOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GiCastle } from 'react-icons/gi'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  useProfile, useUpdateProfile,
  useSetClass, useRenameKingdom, useAbandonKingdom,
} from '@/features/profile/useProfile'
import { useKingdoms } from '@/features/kingdom/useKingdom'
import { useAuth } from '@/features/auth/useAuth'
import { usePushNotifications } from '@/features/push/usePushNotifications'

// ── Character class definitions ───────────────────────────────────────────────

const CLASSES = [
  {
    id: 'collector',
    label: 'Coleccionista',
    emoji: '⛏️',
    desc: '+25% producción de todos los recursos',
    detail: 'Ideal para crecer rápido. Tus minas, canteras y granjas producen un 25% más. Domina la economía antes que nadie.',
    color: 'text-forest-light',
    border: 'border-forest-light/30',
    bg: 'bg-forest/10',
  },
  {
    id: 'general',
    label: 'General',
    emoji: '⚔️',
    desc: '+25% velocidad de ejércitos',
    detail: 'Domina el campo de batalla. Tus tropas viajan más rápido, atacas antes y regresas con el botín antes de que el enemigo reaccione.',
    color: 'text-crimson-light',
    border: 'border-crimson/30',
    bg: 'bg-crimson/10',
  },
  {
    id: 'discoverer',
    label: 'Explorador',
    emoji: '🧭',
    desc: '−25% tiempo de investigación',
    detail: 'El conocimiento es poder. Investigas un 25% más rápido y desbloqueas ventajas tecnológicas que los demás tardan en alcanzar.',
    color: 'text-gold',
    border: 'border-gold/30',
    bg: 'bg-gold/10',
  },
] as const

const CHANGE_COST = 250

export function ProfilePage() {
  const navigate = useNavigate()
  const { data: profile, isLoading } = useProfile()
  const { data: kingdomsData } = useKingdoms()
  const { user, logout } = useAuth()
  const update = useUpdateProfile()
  const setClass = useSetClass()
  const rename = useRenameKingdom()
  const abandon = useAbandonKingdom()

  const [username, setUsername] = useState('')
  const [saved, setSaved] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [abandonConfirm, setAbandonConfirm] = useState<string | null>(null)

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

  async function handleRename(id: string) {
    if (!renameDraft.trim()) return
    await rename.mutateAsync({ name: renameDraft.trim(), id })
    setRenamingId(null)
  }

  async function handleAbandon(id: string) {
    await abandon.mutateAsync(id)
    setAbandonConfirm(null)
  }

  const push = usePushNotifications()
  const kingdoms = kingdomsData?.kingdoms ?? []
  const currentClass = user?.characterClass ?? null
  const ether = user?.ether ?? 0

  if (isLoading) return <ProfileSkeleton />

  const joinDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="anim-fade-up">
        <span className="section-heading">Cuenta</span>
        <h1 className="page-title mt-0.5">Perfil</h1>
        <p className="font-body text-ink-muted text-sm mt-1.5">
          Gestiona tu nombre, reinos y clase de personaje.
        </p>
      </div>

      {/* Two-column layout on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Left column ── */}
        <div className="space-y-6">

          {/* Kingdoms */}
          <section className="space-y-3 anim-fade-up-1">
            <h2 className="section-heading">Mis Reinos</h2>
            {kingdoms.map((k, i) => {
              const isRenaming = renamingId === k.id
              const isConfirming = abandonConfirm === k.id
              const isMain = i === 0
              return (
                <Card key={k.id} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gold-soft border border-gold/20 flex items-center justify-center shrink-0">
                      <GiCastle size={20} className="text-gold-dim" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={e => setRenameDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRename(k.id); if (e.key === 'Escape') setRenamingId(null) }}
                          maxLength={50}
                          autoFocus
                          className="game-input w-full text-sm"
                        />
                      ) : (
                        <p className="font-ui text-sm font-semibold text-ink truncate">{k.name}</p>
                      )}
                      <p className="font-body text-xs text-ink-muted mt-0.5">
                        R{k.realm} · Región {k.region} · Pos. {k.slot}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isMain ? <Badge variant="gold">Principal</Badge> : <Badge variant="stone">Colonia</Badge>}
                    </div>
                  </div>

                  {isRenaming ? (
                    <div className="flex gap-2">
                      <Button variant="primary" size="sm" onClick={() => handleRename(k.id)} disabled={rename.isPending} className="flex-1">
                        {rename.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                        Guardar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRenamingId(null)}>Cancelar</Button>
                    </div>
                  ) : isConfirming ? (
                    <div className="space-y-2">
                      <p className="font-body text-xs text-crimson">¿Abandonar esta colonia? Perderás todos los recursos, edificios y tropas.</p>
                      <div className="flex gap-2">
                        <Button variant="danger" size="sm" onClick={() => handleAbandon(k.id)} disabled={abandon.isPending} className="flex-1">
                          {abandon.isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          Confirmar abandono
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setAbandonConfirm(null)}>Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setRenamingId(k.id); setRenameDraft(k.name) }}>
                        <Pencil size={11} />Renombrar
                      </Button>
                      {!isMain && kingdoms.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => setAbandonConfirm(k.id)} className="text-crimson hover:text-crimson">
                          <Trash2 size={11} />Abandonar
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </section>

          {/* Account info */}
          <Card className="p-5 space-y-3 anim-fade-up-2">
            <h2 className="font-ui text-sm font-semibold text-ink uppercase tracking-widest">
              Información de cuenta
            </h2>
            <div className="space-y-3">
              <InfoRow icon={<Mail size={13} />} label="Correo electrónico" value={profile?.email ?? '—'} />
              <InfoRow icon={<Calendar size={13} />} label="Fecha de registro" value={joinDate} />
            </div>
          </Card>

          {/* Username */}
          <Card className="p-5 space-y-4 anim-fade-up-3">
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
              {update.isPending ? <Loader2 size={12} className="animate-spin" /> : saved ? '✓' : <Save size={12} />}
              {update.isPending ? 'Guardando…' : saved ? 'Guardado' : 'Guardar cambios'}
            </Button>
          </Card>

          {/* Push notifications */}
          {push.state !== 'unsupported' && (
            <Card className="p-5 space-y-3 anim-fade-up-3">
              <h2 className="font-ui text-sm font-semibold text-ink uppercase tracking-widest">
                Notificaciones
              </h2>
              <p className="font-body text-xs text-ink-muted/70">
                {push.state === 'subscribed'
                  ? 'Recibirás alertas cuando te ataquen, tus colas terminen o empiece una nueva temporada.'
                  : push.state === 'denied'
                    ? 'Has bloqueado las notificaciones en tu navegador.'
                    : 'Activa las notificaciones para no perderte ataques ni finales de temporada.'}
              </p>
              {push.state !== 'denied' && (
                <Button
                  variant={push.state === 'subscribed' ? 'ghost' : 'primary'}
                  size="sm"
                  onClick={push.state === 'subscribed' ? push.unsubscribe : push.subscribe}
                  disabled={push.state === 'loading'}
                  className="w-full"
                >
                  {push.state === 'loading'
                    ? <Loader2 size={12} className="animate-spin" />
                    : push.state === 'subscribed'
                      ? <BellOff size={12} />
                      : <Bell size={12} />}
                  {push.state === 'subscribed' ? 'Desactivar notificaciones' : 'Activar notificaciones'}
                </Button>
              )}
            </Card>
          )}

          {/* Logout */}
          <Card className="p-5 anim-fade-up-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-ui text-sm font-semibold text-ink">Cerrar sesión</p>
                <p className="font-body text-xs text-ink-muted/70 mt-0.5">{profile?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => { await logout(); navigate('/login', { replace: true }) }}
                className="text-crimson hover:text-crimson hover:bg-crimson/5 shrink-0"
              >
                <LogOut size={12} />
                Salir
              </Button>
            </div>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">
          <section className="space-y-3 anim-fade-up-2">
            <div className="flex items-center justify-between">
              <h2 className="section-heading mb-0">Clase de Personaje</h2>
              {currentClass && (
                <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <Zap size={11} className="text-gold" />
                  <span className="font-ui tabular-nums text-gold-dim font-semibold">{ether}</span>
                  <span>Éter</span>
                </div>
              )}
            </div>

            {!currentClass && (
              <p className="font-body text-sm text-ink-muted">
                Elige una clase para especializarte. La primera selección es <strong className="text-ink">gratuita</strong>.
                Cambiar de clase cuesta <strong className="text-gold">{CHANGE_COST} Éter</strong>.
              </p>
            )}

            <div className="grid gap-3">
              {CLASSES.map(cls => {
                const isActive = currentClass === cls.id
                const canChange = !isActive && (currentClass === null || ether >= CHANGE_COST)
                const cost = currentClass ? CHANGE_COST : 0
                return (
                  <button
                    key={cls.id}
                    disabled={setClass.isPending || (!canChange && !isActive)}
                    onClick={() => !isActive && canChange && setClass.mutate(cls.id)}
                    className={`w-full text-left rounded-lg border p-4 transition-all ${
                      isActive
                        ? `${cls.bg} ${cls.border} shadow-sm`
                        : canChange
                          ? 'border-gold/10 bg-white hover:border-gold/25 hover:bg-parchment cursor-pointer'
                          : 'border-gold/5 bg-white opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none mt-0.5">{cls.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-ui text-sm font-semibold ${isActive ? cls.color : 'text-ink'}`}>
                            {cls.label}
                          </span>
                          {isActive && <Badge variant="gold">Activa</Badge>}
                          {!isActive && cost > 0 && canChange && (
                            <span className="font-ui text-xs text-gold-dim flex items-center gap-0.5">
                              <Zap size={9} />{cost}
                            </span>
                          )}
                        </div>
                        <p className={`font-ui text-xs font-semibold mt-0.5 ${isActive ? cls.color : 'text-ink-muted'}`}>
                          {cls.desc}
                        </p>
                        <p className="font-body text-xs text-ink-muted/70 mt-1 leading-relaxed">
                          {cls.detail}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {currentClass && ether < CHANGE_COST && (
              <p className="font-body text-xs text-ink-muted/60 italic">
                Necesitas {CHANGE_COST} Éter para cambiar de clase. Consigue Éter enviando expediciones a las Tierras Ignotas.
              </p>
            )}
          </section>
        </div>

      </div>
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
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-16" />
        <div className="skeleton h-8 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="skeleton h-2.5 w-20" />
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="skeleton w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-3 w-28" />
              </div>
            </div>
          </Card>
          <div className="skeleton h-24 rounded-lg" />
          <div className="skeleton h-32 rounded-lg" />
        </div>
        <div className="space-y-3">
          <div className="skeleton h-2.5 w-32" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
