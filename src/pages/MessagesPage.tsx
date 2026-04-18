import { useState } from 'react'
import { Mail, MailOpen, Sword, Eye, CheckCheck } from 'lucide-react'
import { GiWoodPile, GiStoneBlock, GiWheat } from 'react-icons/gi'
import { useMessages, useMarkAllRead, type GameMessage } from '@/hooks/useMessages'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatResource } from '@/lib/format'

export function MessagesPage() {
  const { data, isLoading } = useMessages()
  const markAll = useMarkAllRead()
  const [selected, setSelected] = useState<GameMessage | null>(null)

  const messages = data?.messages ?? []
  const unread   = messages.filter(m => !m.viewed).length

  if (isLoading) return <MessagesSkeleton />

  return (
    <div className="space-y-6">
      <div className="anim-fade-up flex items-center justify-between gap-4 flex-wrap">
        <div>
          <span className="section-heading">Mensajería</span>
          <h1 className="page-title mt-0.5">Mensajes</h1>
        </div>
        {unread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <CheckCheck size={13} />
            Marcar todo como leído
          </Button>
        )}
      </div>

      {messages.length === 0 ? (
        <Card className="p-10 text-center anim-fade-up-1">
          <MailOpen size={28} className="mx-auto text-ink-muted/30 mb-3" />
          <p className="font-body text-sm text-ink-muted/60">No tienes mensajes</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 anim-fade-up-1">
          {/* List */}
          <div className="space-y-1.5">
            {messages.map(msg => (
              <button
                key={msg.id}
                onClick={() => setSelected(msg)}
                className={`w-full text-left rounded-lg border px-3.5 py-3 transition-colors ${
                  selected?.id === msg.id
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

          {/* Detail */}
          <div>
            {selected ? (
              <MessageDetail message={selected} />
            ) : (
              <Card className="p-10 text-center h-full flex flex-col items-center justify-center">
                <MailOpen size={24} className="text-ink-muted/25 mb-2" />
                <p className="font-body text-sm text-ink-muted/50">Selecciona un mensaje</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MessageTypeBadge({ type }: { type: string }) {
  if (type === 'battle') return <Badge variant="crimson"><Sword size={9} className="mr-0.5" />Batalla</Badge>
  if (type === 'spy')    return <Badge variant="stone"><Eye size={9} className="mr-0.5" />Espionaje</Badge>
  return <Badge variant="gold">Sistema</Badge>
}

function MessageDetail({ message }: { message: GameMessage }) {
  const d = message.data

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-start gap-3 pb-4 border-b border-gold/10">
        <span className="text-gold mt-0.5">
          {message.type === 'battle' ? <Sword size={16} /> : <Eye size={16} />}
        </span>
        <div>
          <h2 className="font-display text-base text-ink">{message.subject}</h2>
          <p className="font-body text-xs text-ink-muted/60 mt-0.5">
            {new Date(message.createdAt).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}
          </p>
        </div>
      </div>

      {message.type === 'battle' && <BattleDetail data={d} />}
      {message.type === 'spy'    && <SpyDetail    data={d} />}
    </Card>
  )
}

function BattleDetail({ data }: { data: Record<string, unknown> }) {
  const outcome  = data.outcome as string | undefined
  const rounds   = data.rounds  as number | undefined
  const loot     = data.loot    as { wood: number; stone: number; grain: number } | undefined
  const debris   = data.debris  as { wood: number; stone: number } | undefined
  const lostAtk  = data.lostAtk as Record<string, number> | undefined
  const lostDef  = data.lostDef as Record<string, number> | undefined
  const role     = data.role    as string | undefined  // 'attacker' | 'defender'

  const isVictory = outcome === 'victory'
  const outcomeLabel = role === 'defender'
    ? (isVictory ? 'Rechazado' : 'Derrotado')
    : (isVictory ? 'Victoria'  : 'Derrota')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant={isVictory ? 'forest' : 'crimson'}>
          {outcomeLabel}
        </Badge>
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
            <ResourcePill icon={<GiWoodPile  size={13} />} value={loot.wood}  label="Madera" />
            <ResourcePill icon={<GiStoneBlock size={13} />} value={loot.stone} label="Piedra" />
            <ResourcePill icon={<GiWheat     size={13} />} value={loot.grain} label="Grano"  />
          </div>
        </div>
      )}

      {debris && (debris.wood > 0 || debris.stone > 0) && (
        <div>
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">
            Campo de escombros
          </p>
          <div className="flex gap-4 flex-wrap">
            {debris.wood  > 0 && <ResourcePill icon={<GiWoodPile  size={13} />} value={debris.wood}  label="Madera" />}
            {debris.stone > 0 && <ResourcePill icon={<GiStoneBlock size={13} />} value={debris.stone} label="Piedra" />}
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

function SpyDetail({ data }: { data: Record<string, unknown> }) {
  const targetName    = data.targetName    as string | undefined
  const targetCoords  = data.targetCoords  as string | undefined
  const detected      = data.detected      as boolean | undefined
  const resources     = data.resources     as { wood: number; stone: number; grain: number } | undefined
  const units         = data.units         as Record<string, number> | undefined
  const defenses      = data.defenses      as Record<string, number> | undefined
  const buildings     = data.buildings     as Record<string, number> | undefined
  const research      = data.research      as Record<string, number> | undefined
  const isDetection   = data.isDetection   as boolean | undefined

  if (isDetection) {
    return (
      <div className="space-y-3">
        <Badge variant="crimson"><Eye size={10} className="mr-1" />Espía detectado</Badge>
        <p className="font-body text-sm text-ink-muted">
          Se ha detectado un intento de espionaje en tu reino.
          {detected !== undefined && ` Probabilidad de detección: ${Math.round((data.detectionChance as number) ?? 0)}%.`}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-body text-sm text-ink">
          Reino espiado: <strong>{targetName ?? '—'}</strong>
          {targetCoords && <span className="text-ink-muted/70 ml-1">[{targetCoords}]</span>}
        </span>
        {detected && <Badge variant="crimson">Detectado</Badge>}
      </div>

      {resources && (
        <div>
          <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Recursos</p>
          <div className="flex gap-4 flex-wrap">
            <ResourcePill icon={<GiWoodPile  size={13} />} value={resources.wood}  label="Madera" />
            <ResourcePill icon={<GiStoneBlock size={13} />} value={resources.stone} label="Piedra" />
            <ResourcePill icon={<GiWheat     size={13} />} value={resources.grain} label="Grano"  />
          </div>
        </div>
      )}

      {units && Object.keys(units).length > 0 && (
        <LossTable title="Tropas" losses={units} />
      )}
      {defenses && Object.keys(defenses).length > 0 && (
        <LossTable title="Defensas" losses={defenses} />
      )}
      {buildings && Object.keys(buildings).length > 0 && (
        <LossTable title="Edificios" losses={buildings} />
      )}
      {research && Object.keys(research).length > 0 && (
        <LossTable title="Investigaciones" losses={research} />
      )}
    </div>
  )
}

function ResourcePill({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
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
      <p className="font-ui text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">{title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
        {entries.map(([unit, count]) => (
          <div key={unit} className="flex items-center justify-between gap-2 font-body text-xs">
            <span className="text-ink-muted capitalize">{unit.replace(/([A-Z])/g, ' $1').trim()}</span>
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
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-14" />
        <div className="skeleton h-8 w-40" />
      </div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
