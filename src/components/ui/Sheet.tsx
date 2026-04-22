import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: string
}

export function Sheet({ open, onClose, title, children, maxWidth = 'max-w-lg' }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm anim-backdrop-in"
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className={`
          relative w-full ${maxWidth} max-h-[90dvh] lg:max-h-[85dvh]
          bg-surface border border-gold/20
          rounded-t-2xl lg:rounded-2xl
          shadow-2xl overflow-hidden flex flex-col
          anim-sheet-up lg:anim-sheet-fade
        `}
      >
        {/* Drag handle (mobile only) */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-ink/15" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gold/15 shrink-0">
            <h2 className="font-ui text-sm font-semibold text-ink truncate pr-4">{title}</h2>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-parchment-warm transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Close button when no title */}
        {!title && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-parchment-warm transition-colors z-10"
          >
            <X size={15} />
          </button>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
