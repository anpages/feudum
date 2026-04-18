import { useState } from 'react'
import {
  Mail,
  MailOpen,
  Sword,
  Eye,
  CheckCheck,
  PenLine,
  Send,
  Loader2,
  User,
  Compass,
  Rocket,
  Wind,
  Zap,
  Skull,
} from 'lucide-react'
import { GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import {
  useMessages,
  useMarkAllRead,
  useSendMessage,
  type GameMessage,
} from '@/features/messages/useMessages'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { formatResource } from '@/lib/format'
import { toast } from '@/lib/toast'

export function MessagesPage() {
  const { data, isLoading } = useMessages()
  const markAll = useMarkAllRead()
  const [selected, setSelected] = useState<GameMessage | null>(null)
  const [composing, setComposing] = useState(false)
  const [replyTo, setReplyTo] = useState('')

  const messages = data?.messages ?? []
  const unread = messages.filter(m => !m.viewed).length

  function openCompose(to = '') {
    setSelected(null)
    setReplyTo(to)
    setComposing(true)
  }

  if (isLoading) return <MessagesSkeleton />

  return (
    <div className="space-y-6">
      <div className="anim-fade-up flex items-center justify-between gap-4 flex-wrap">
        <div>
          <span className="section-heading">Mensajería</span>
          <h1 className="page-title mt-0.5">Mensajes</h1>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
            >
              <CheckCheck size={13} />
              Marcar todo leído
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => openCompose()}>
            <PenLine size={13} />
            Nuevo mensaje
          </Button>
        </div>
      </div>

      {messages.length === 0 ? (
        <Card className="p-10 text-center anim-fade-up-1">
          <MailOpen size={28} className="mx-auto text-ink-muted/30 mb-3" />
          <p className="font-body text-sm text-ink-muted/60">No tienes mensajes</p>
          <button
            onClick={() => openCompose()}
            className="mt-3 font-ui text-xs text-gold hover:text-gold-light transition-colors"
          >
            Enviar el primero →
          </button>
        </Card>
      ) : (
        <div className="space-y-1.5 anim-fade-up-1">
          {messages.map(msg => (
            <button
              key={msg.id}
              onClick={() => { setSelected(msg); setComposing(false) }}
              className={`w-full text-left rounded-lg border px-3.5 py-3 transition-colors ${
                !composing && selected?.id === msg.id
                  ? 'border-gold/60 bg-gold/5'
                  : 'border-gold/10 bg-parchment hover:bg-gold/5'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className={`mt-0.5 shrink-0 ${msg.viewed ? 'text-ink-muted/40' : 'text-gold'}`}>
                  {msg.viewed ? <MailOpen size={14} /> : <Mail size={14} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-ui text-sm truncate ${msg.viewed ? 'text-ink-muted' : 'text-ink font-semibold'}`}>
                      {msg.subject}
                    </span>
                    <MessageTypeBadge type={msg.type} />
                  </div>
                  <p className="font-body text-xs text-ink-muted/60 mt-0.5 truncate">
                    {new Date(msg.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Message detail — Sheet */}
      <Sheet
        open={!!selected && !composing}
        onClose={() => setSelected(null)}
        title={selected?.subject}
        maxWidth="max-w-xl"
      >
        {selected && (
          <MessageDetail message={selected} onReply={username => openCompose(username)} />
        )}
      </Sheet>

      {/* Compose — Sheet */}
      <Sheet
        open={composing}
        onClose={() => setComposing(false)}
        title="Nuevo mensaje"
        maxWidth="max-w-lg"
      >
        <ComposePanel onClose={() => setComposing(false)} initialTo={replyTo} />
      </Sheet>
    </div>
  )
}

// ── Compose panel ─────────────────────────────────────────────────────────────

function ComposePanel({ onClose, initialTo = '' }: { onClose: () => void; initialTo?: string }) {
  const send = useSendMessage()
  const [to, setTo] = useState(initialTo)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) return
    try {
      await send.mutateAsync({ to: to.trim(), subject: subject.trim(), body: body.trim() })
      toast.success('Mensaje enviado')
      onClose()
    } catch {
      // error shown inline
    }
  }

  return (
    <div className="p-5 space-y-4">
      <div className="space-y-3">
        <div>
          <label className="font-ui text-xs text-ink-muted uppercase tracking-wider block mb-1">Para (username)</label>
          <div className="relative">
            <User size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted/50" />
            <input type="text" value={to} onChange={e => setTo(e.target.value)} placeholder="nombre_usuario" className="game-input w-full pl-8" />
          </div>
        </div>
        <div>
          <label className="font-ui text-xs text-ink-muted uppercase tracking-wider block mb-1">Asunto</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} maxLength={100} placeholder="Motivo del mensaje..." className="game-input w-full" />
        </div>
        <div>
          <label className="font-ui text-xs text-ink-muted uppercase tracking-wider block mb-1">Mensaje</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={6} placeholder="Escribe tu mensaje aquí..." className="game-input w-full resize-none" />
          <p className="text-right font-ui text-[0.6rem] text-ink-muted/50 mt-0.5">{body.length}/2000</p>
        </div>
      </div>

      {send.isError && (
        <p className="font-ui text-xs text-crimson">{(send.error as Error)?.message ?? 'Error al enviar'}</p>
      )}

      <Button variant="primary" className="w-full" disabled={!to.trim() || !subject.trim() || !body.trim() || send.isPending} onClick={handleSend}>
        {send.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        {send.isPending ? 'Enviando…' : 'Enviar mensaje'}
      </Button>
    </div>
  )
}

// ── Message type badge ────────────────────────────────────────────────────────

function MessageTypeBadge({ type }: { type: string }) {
  if (type === 'battle')
    return (
      <Badge variant="crimson">
        <Sword size={9} className="mr-0.5" />
        Batalla
      </Badge>
    )
  if (type === 'spy')
    return (
      <Badge variant="stone">
        <Eye size={9} className="mr-0.5" />
        Espionaje
      </Badge>
    )
  if (type === 'player')
    return (
      <Badge variant="gold">
        <User size={9} className="mr-0.5" />
        Mensaje
      </Badge>
    )
  if (type === 'expedition')
    return (
      <Badge variant="forest">
        <Compass size={9} className="mr-0.5" />
        Expedición
      </Badge>
    )
  return <Badge variant="gold">Sistema</Badge>
}

// ── Message detail ────────────────────────────────────────────────────────────

function MessageDetail({
  message,
  onReply,
}: {
  message: GameMessage
  onReply: (username: string) => void
}) {
  const d = message.data

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-3 pb-4 border-b border-gold/10">
        <span className="text-gold">
          {message.type === 'battle'
            ? (d.type === 'missile' ? <Rocket size={15} /> : <Sword size={15} />)
            : message.type === 'spy'
              ? <Eye size={15} />
              : message.type === 'expedition'
                ? <Compass size={15} />
                : <Mail size={15} />}
        </span>
        <p className="font-body text-xs text-ink-muted/60">
          {new Date(message.createdAt).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
        </p>
        {message.type === 'player' && typeof d.fromUsername === 'string' && (
          <button
            onClick={() => onReply(d.fromUsername as string)}
            className="ml-auto shrink-0 font-ui text-xs text-gold hover:text-gold-light transition-colors flex items-center gap-1"
          >
            <PenLine size={11} /> Responder
          </button>
        )}
      </div>

      {message.type === 'battle' && <BattleDetail data={d} />}
      {message.type === 'spy' && <SpyDetail data={d} />}
      {message.type === 'player' && <PlayerDetail data={d} />}
      {message.type === 'expedition' && <ExpeditionDetail data={d} />}
    </div>
  )
}

// ── Player message ────────────────────────────────────────────────────────────

function PlayerDetail({ data }: { data: Record<string, unknown> }) {
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

// ── Battle detail ─────────────────────────────────────────────────────────────

function BattleDetail({ data }: { data: Record<string, unknown> }) {
  if (data.type === 'missile') return <MissileDetail data={data} />

  const outcome = data.outcome as string | undefined
  const rounds = data.rounds as number | undefined
  const loot = data.loot as { wood: number; stone: number; grain: number } | undefined
  const debris = data.debris as { wood: number; stone: number } | undefined
  const lostAtk = data.lostAtk as Record<string, number> | undefined
  const lostDef = data.lostDef as Record<string, number> | undefined
  const role = data.role as string | undefined

  const isVictory = outcome === 'victory'
  const outcomeLabel =
    role === 'defender'
      ? isVictory
        ? 'Rechazado'
        : 'Derrotado'
      : isVictory
        ? 'Victoria'
        : 'Derrota'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant={isVictory ? 'forest' : 'crimson'}>{outcomeLabel}</Badge>
        {rounds !== undefined && (
          <span className="font-body text-xs text-ink-muted/60">{rounds} rondas de combate</span>
        )}
      </div>

      {loot && (loot.wood > 0 || loot.stone > 0 || loot.grain > 0) && (
        <div>
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            {role === 'defender' ? 'Recursos robados' : 'Botín capturado'}
          </p>
          <div className="flex gap-4 flex-wrap">
            <ResourcePill icon={<GiWoodPile size={13} />} value={loot.wood} label="Madera" />
            <ResourcePill icon={<GiStoneBlock size={13} />} value={loot.stone} label="Piedra" />
            <ResourcePill icon={<GiWheat size={13} />} value={loot.grain} label="Grano" />
          </div>
        </div>
      )}

      {debris && (debris.wood > 0 || debris.stone > 0) && (
        <div>
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            Campo de escombros
          </p>
          <div className="flex gap-4 flex-wrap">
            {debris.wood > 0 && (
              <ResourcePill icon={<GiWoodPile size={13} />} value={debris.wood} label="Madera" />
            )}
            {debris.stone > 0 && (
              <ResourcePill icon={<GiStoneBlock size={13} />} value={debris.stone} label="Piedra" />
            )}
          </div>
        </div>
      )}

      {lostAtk && Object.keys(lostAtk).length > 0 && (
        <LossTable title="Bajas atacante" losses={lostAtk} />
      )}
      {lostDef && Object.keys(lostDef).length > 0 && (
        <LossTable title="Bajas defensor" losses={lostDef} />
      )}
    </div>
  )
}

// ── Spy detail ────────────────────────────────────────────────────────────────

function SpyDetail({ data }: { data: Record<string, unknown> }) {
  const targetName = data.targetName as string | undefined
  const detected = data.detected as boolean | undefined
  const resources = data.resources as { wood: number; stone: number; grain: number } | undefined
  const units = data.units as Record<string, number> | undefined
  const defenses = data.defenses as Record<string, number> | undefined
  const buildings = data.buildings as Record<string, number> | undefined
  const researchData = data.researchData as Record<string, number> | undefined
  const isDetection = data.isDetection as boolean | undefined

  if (isDetection) {
    return (
      <div className="space-y-3">
        <Badge variant="crimson">
          <Eye size={10} className="mr-1" />
          Espía detectado
        </Badge>
        <p className="font-body text-sm text-ink-muted">
          Se ha detectado un intento de espionaje en tu reino.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-body text-sm text-ink">
          Reino espiado: <strong>{targetName ?? '—'}</strong>
        </span>
        {detected && <Badge variant="crimson">Detectado</Badge>}
      </div>

      {resources && (
        <div>
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            Recursos
          </p>
          <div className="flex gap-4 flex-wrap">
            <ResourcePill icon={<GiWoodPile size={13} />} value={resources.wood} label="Madera" />
            <ResourcePill
              icon={<GiStoneBlock size={13} />}
              value={resources.stone}
              label="Piedra"
            />
            <ResourcePill icon={<GiWheat size={13} />} value={resources.grain} label="Grano" />
          </div>
        </div>
      )}

      {units && Object.keys(units).length > 0 && <LossTable title="Tropas" losses={units} />}
      {defenses && Object.keys(defenses).length > 0 && (
        <LossTable title="Defensas" losses={defenses} />
      )}
      {buildings && Object.keys(buildings).length > 0 && (
        <LossTable title="Edificios" losses={buildings} />
      )}
      {researchData && Object.keys(researchData).length > 0 && (
        <LossTable title="Investigaciones" losses={researchData} />
      )}
    </div>
  )
}

// ── Missile detail ────────────────────────────────────────────────────────────

function MissileDetail({ data }: { data: Record<string, unknown> }) {
  const targetName = data.targetName as string | null | undefined
  const sentMissiles = (data.sentMissiles as number) ?? 0
  const intercepted = (data.intercepted as number) ?? 0
  const remaining = (data.remaining as number) ?? 0
  const damageDealt = (data.damageDealt as Record<string, number>) ?? {}
  const hasTargetName = typeof targetName === 'string' && targetName.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-body text-sm text-ink">
          Objetivo: <strong>{hasTargetName ? targetName : '(sin defensa)'}</strong>
        </span>
        {remaining === 0 && intercepted > 0 && (
          <Badge variant="stone">Interceptados</Badge>
        )}
        {remaining > 0 && Object.keys(damageDealt).length > 0 && (
          <Badge variant="crimson">Impacto</Badge>
        )}
        {remaining > 0 && Object.keys(damageDealt).length === 0 && (
          <Badge variant="stone">Sin objetivo</Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-gold/10 bg-obsidian/60 p-3 text-center">
          <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted mb-1">Lanzados</p>
          <p className="font-ui text-lg text-ink tabular-nums">{sentMissiles}</p>
        </div>
        <div className="rounded border border-gold/10 bg-obsidian/60 p-3 text-center">
          <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted mb-1">Interceptados</p>
          <p className="font-ui text-lg text-gold-dim tabular-nums">{intercepted}</p>
        </div>
        <div className="rounded border border-gold/10 bg-obsidian/60 p-3 text-center">
          <p className="font-ui text-[0.65rem] uppercase tracking-wider text-ink-muted mb-1">Impactos</p>
          <p className="font-ui text-lg text-crimson tabular-nums">{remaining}</p>
        </div>
      </div>

      {Object.keys(damageDealt).length > 0 && (
        <LossTable title="Defensas destruidas" losses={damageDealt} />
      )}
    </div>
  )
}

// ── Expedition detail ─────────────────────────────────────────────────────────

function ExpeditionDetail({ data }: { data: Record<string, unknown> }) {
  const outcome = data.outcome as string | undefined

  if (outcome === 'nothing') {
    return (
      <div className="space-y-3">
        <p className="font-body text-sm text-ink-muted">
          Tu expedición regresó sin encontrar nada digno de mención.
        </p>
      </div>
    )
  }

  if (outcome === 'resources') {
    const found = data.found as { wood?: number; stone?: number; grain?: number } | undefined
    return (
      <div className="space-y-3">
        <Badge variant="forest">
          <GiWoodPile size={9} className="mr-0.5" />
          Recursos encontrados
        </Badge>
        {found && (
          <div className="flex gap-4 flex-wrap">
            {(found.wood ?? 0) > 0 && <ResourcePill icon={<GiWoodPile size={13} />} value={found.wood!} label="Madera" />}
            {(found.stone ?? 0) > 0 && <ResourcePill icon={<GiStoneBlock size={13} />} value={found.stone!} label="Piedra" />}
            {(found.grain ?? 0) > 0 && <ResourcePill icon={<GiWheat size={13} />} value={found.grain!} label="Grano" />}
          </div>
        )}
      </div>
    )
  }

  if (outcome === 'units') {
    const found = data.found as Record<string, number> | undefined
    return (
      <div className="space-y-3">
        <Badge variant="forest">
          <Sword size={9} className="mr-0.5" />
          Supervivientes encontrados
        </Badge>
        {found && Object.keys(found).length > 0 && (
          <LossTable title="Unidades recuperadas" losses={found} />
        )}
      </div>
    )
  }

  if (outcome === 'delay') {
    const mult = data.multiplier as number | undefined
    return (
      <div className="space-y-3">
        <Badge variant="stone">
          <Wind size={9} className="mr-0.5" />
          Expedición retrasada
        </Badge>
        <p className="font-body text-sm text-ink-muted">
          Tu expedición encontró condiciones adversas y tardará {mult ? `${mult}×` : 'más'} en regresar.
        </p>
      </div>
    )
  }

  if (outcome === 'speedup') {
    const frac = data.fraction as number | undefined
    return (
      <div className="space-y-3">
        <Badge variant="forest">
          <Zap size={9} className="mr-0.5" />
          Viento a favor
        </Badge>
        <p className="font-body text-sm text-ink-muted">
          Tu expedición llegó antes de lo esperado{frac ? ` (−${Math.round(frac * 100)}%)` : ''}.
        </p>
      </div>
    )
  }

  if (outcome === 'bandits' || outcome === 'demons') {
    const battleOutcome = data.battleOutcome as string | undefined
    const lostAtk = data.lostAtk as Record<string, number> | undefined
    const lostDef = data.lostDef as Record<string, number> | undefined
    const isVictory = battleOutcome === 'victory'
    const label = outcome === 'bandits' ? 'Merodeadores' : 'Bestias Oscuras'
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant={isVictory ? 'forest' : 'crimson'}>
            <Skull size={9} className="mr-0.5" />
            {label} — {isVictory ? 'Victoria' : 'Derrota'}
          </Badge>
        </div>
        {!isVictory && (
          <p className="font-body text-xs text-crimson">Tu flota fue destruida.</p>
        )}
        {lostAtk && Object.keys(lostAtk).length > 0 && (
          <LossTable title="Bajas propias" losses={lostAtk} />
        )}
        {lostDef && Object.keys(lostDef).length > 0 && (
          <LossTable title={`Bajas ${label}`} losses={lostDef} />
        )}
      </div>
    )
  }

  if (outcome === 'ether') {
    const amount = data.amount as number | undefined
    return (
      <div className="space-y-3">
        <Badge variant="gold">
          <Zap size={9} className="mr-0.5" />
          Éter Oscuro encontrado
        </Badge>
        <p className="font-body text-sm text-ink">
          Tu expedición regresó con <strong>{amount?.toLocaleString() ?? '?'}</strong> unidades de Éter Oscuro.
        </p>
      </div>
    )
  }

  if (outcome === 'black_hole') {
    return (
      <div className="space-y-3">
        <Badge variant="crimson">
          <Skull size={9} className="mr-0.5" />
          Tormenta Arcana
        </Badge>
        <p className="font-body text-sm text-crimson">
          Tu flota fue absorbida por una Tormenta Arcana. No hubo supervivientes.
        </p>
      </div>
    )
  }

  if (outcome === 'merchant') {
    const expired = data.expired as boolean | undefined
    const accepted = data.accepted as boolean | undefined
    const offer = data.offer as { give?: Record<string, number>; receive?: Record<string, number> } | undefined
    return (
      <div className="space-y-4">
        <Badge variant={accepted ? 'forest' : 'stone'}>
          {expired ? 'Oferta expirada' : accepted ? 'Intercambio completado' : 'Oferta rechazada'}
        </Badge>
        {offer && (
          <div className="space-y-3">
            {offer.give && Object.values(offer.give).some(v => v > 0) && (
              <div>
                <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Entregaste</p>
                <div className="flex gap-4 flex-wrap">
                  {(offer.give.wood ?? 0) > 0 && <ResourcePill icon={<GiWoodPile size={13} />} value={offer.give.wood!} label="Madera" />}
                  {(offer.give.stone ?? 0) > 0 && <ResourcePill icon={<GiStoneBlock size={13} />} value={offer.give.stone!} label="Piedra" />}
                  {(offer.give.grain ?? 0) > 0 && <ResourcePill icon={<GiWheat size={13} />} value={offer.give.grain!} label="Grano" />}
                </div>
              </div>
            )}
            {offer.receive && Object.values(offer.receive).some(v => v > 0) && (
              <div>
                <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Recibiste</p>
                <div className="flex gap-4 flex-wrap">
                  {(offer.receive.wood ?? 0) > 0 && <ResourcePill icon={<GiWoodPile size={13} />} value={offer.receive.wood!} label="Madera" />}
                  {(offer.receive.stone ?? 0) > 0 && <ResourcePill icon={<GiStoneBlock size={13} />} value={offer.receive.stone!} label="Piedra" />}
                  {(offer.receive.grain ?? 0) > 0 && <ResourcePill icon={<GiWheat size={13} />} value={offer.receive.grain!} label="Grano" />}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <p className="font-body text-sm text-ink-muted">
      Expedición completada.
    </p>
  )
}

// ── Shared components ─────────────────────────────────────────────────────────

function ResourcePill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5 font-ui text-sm">
      <span className="text-gold/70">{icon}</span>
      <span className="text-ink tabular-nums">{formatResource(value)}</span>
      <span className="text-ink-muted/60 text-xs">{label}</span>
    </div>
  )
}

function LossTable({ title, losses }: { title: string; losses: Record<string, number> }) {
  const entries = Object.entries(losses).filter(([, v]) => v > 0)
  if (entries.length === 0) return null
  return (
    <div>
      <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
        {title}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
        {entries.map(([unit, count]) => (
          <div key={unit} className="flex items-center justify-between gap-2 font-body text-xs">
            <span className="text-ink-muted capitalize">
              {unit.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <span className="text-ink tabular-nums">{count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MessagesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-2.5 w-14" />
          <div className="skeleton h-8 w-40" />
        </div>
        <div className="skeleton h-8 w-32 rounded" />
      </div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
