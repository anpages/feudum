import { useState } from 'react'
import { User, Send, Loader2 } from 'lucide-react'
import { useSendMessage } from '@/features/messages/useMessages'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast'

export function ComposePanel({ onClose, initialTo = '' }: { onClose: () => void; initialTo?: string }) {
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
            <input
              type="text"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="nombre_usuario"
              className="game-input w-full pl-8"
            />
          </div>
        </div>
        <div>
          <label className="font-ui text-xs text-ink-muted uppercase tracking-wider block mb-1">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            maxLength={100}
            placeholder="Motivo del mensaje..."
            className="game-input w-full"
          />
        </div>
        <div>
          <label className="font-ui text-xs text-ink-muted uppercase tracking-wider block mb-1">Mensaje</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={2000}
            rows={6}
            placeholder="Escribe tu mensaje aquí..."
            className="game-input w-full resize-none"
          />
          <p className="text-right font-ui text-[0.6rem] text-ink-muted/50 mt-0.5">{body.length}/2000</p>
        </div>
      </div>

      {send.isError && (
        <p className="font-ui text-xs text-crimson">{(send.error as Error)?.message ?? 'Error al enviar'}</p>
      )}

      <Button
        variant="primary"
        className="w-full"
        disabled={!to.trim() || !subject.trim() || !body.trim() || send.isPending}
        onClick={handleSend}
      >
        {send.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        {send.isPending ? 'Enviando…' : 'Enviar mensaje'}
      </Button>
    </div>
  )
}
