import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useToastStore } from '@/lib/toast'

export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg
            pointer-events-auto animate-slide-up min-w-[260px] max-w-[360px]
            ${toast.type === 'success' ? 'bg-parchment border-forest/30 text-ink' : ''}
            ${toast.type === 'error' ? 'bg-parchment border-crimson/40 text-ink' : ''}
            ${toast.type === 'info' ? 'bg-parchment border-gold/30 text-ink' : ''}
          `}
        >
          <span
            className={`shrink-0 mt-0.5 ${
              toast.type === 'success'
                ? 'text-forest-light'
                : toast.type === 'error'
                  ? 'text-crimson'
                  : 'text-gold'
            }`}
          >
            {toast.type === 'success' && <CheckCircle size={15} />}
            {toast.type === 'error' && <AlertCircle size={15} />}
            {toast.type === 'info' && <Info size={15} />}
          </span>
          <p className="font-ui text-sm flex-1 leading-snug">{toast.message}</p>
          <button
            onClick={() => remove(toast.id)}
            className="shrink-0 text-ink-muted/50 hover:text-ink-muted transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
