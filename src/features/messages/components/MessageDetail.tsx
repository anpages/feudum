import { Mail, Sword, Eye, Compass, Rocket, PenLine } from 'lucide-react'
import type { GameMessage } from '@/features/messages/useMessages'
import { BattleMessageDetail } from './BattleMessageDetail'
import { SpyMessageDetail } from './SpyMessageDetail'
import { PlayerMessageDetail } from './PlayerMessageDetail'
import { ExpeditionMessageDetail } from './ExpeditionMessageDetail'

function headerIcon(message: GameMessage) {
  if (message.type === 'battle') {
    return message.data.type === 'missile' ? <Rocket size={15} /> : <Sword size={15} />
  }
  if (message.type === 'spy') return <Eye size={15} />
  if (message.type === 'expedition') return <Compass size={15} />
  return <Mail size={15} />
}

export function MessageDetail({
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
        <span className="text-gold">{headerIcon(message)}</span>
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

      {message.type === 'battle' && <BattleMessageDetail data={d} />}
      {message.type === 'spy' && <SpyMessageDetail data={d} />}
      {message.type === 'player' && <PlayerMessageDetail data={d} />}
      {message.type === 'expedition' && <ExpeditionMessageDetail data={d} />}
    </div>
  )
}
