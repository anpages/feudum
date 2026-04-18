import { useState } from 'react'
import { Mail, MailOpen, CheckCheck, PenLine } from 'lucide-react'
import { useMessages, useMarkAllRead, type GameMessage } from '@/features/messages/useMessages'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { MessageTypeBadge } from './components/MessageTypeBadge'
import { MessageDetail } from './components/MessageDetail'
import { ComposePanel } from './components/ComposePanel'

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
            <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
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
