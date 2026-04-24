import { Sheet } from './Sheet'
import { Button } from './Button'
import { Loader2 } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open, onClose, onConfirm,
  title, message,
  confirmLabel = 'Confirmar',
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="px-5 py-5 space-y-5">
        <p className="font-body text-sm text-ink-mid">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 size={12} className="animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
