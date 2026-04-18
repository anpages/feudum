import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { GiCastle } from 'react-icons/gi'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isIOS] = useState(
    () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as any).standalone
  )
  const [showIOS, setShowIOS] = useState(
    () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as any).standalone
  )

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  if (dismissed) return null

  // iOS manual instructions
  if (isIOS && showIOS) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80">
        <div className="bg-white border border-gold/20 rounded-xl shadow-lg p-4 anim-fade-up">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold-soft border border-gold/20 flex items-center justify-center shrink-0">
              <GiCastle size={16} className="text-gold-dim" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-ui text-xs font-semibold text-ink">Instalar Feudum</p>
              <p className="font-body text-xs text-ink-muted mt-1 leading-relaxed">
                Toca <strong>Compartir</strong> y luego{' '}
                <strong>«Añadir a pantalla de inicio»</strong> para instalar la app.
              </p>
            </div>
            <button
              onClick={() => {
                setShowIOS(false)
                setDismissed(true)
              }}
              className="p-1 rounded text-ink-muted/50 hover:text-ink-muted transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Android / Chrome prompt
  if (!deferredPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80">
      <div className="bg-white border border-gold/20 rounded-xl shadow-lg p-4 anim-fade-up">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold-soft border border-gold/20 flex items-center justify-center shrink-0">
            <GiCastle size={16} className="text-gold-dim" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-ui text-xs font-semibold text-ink">Instalar Feudum</p>
            <p className="font-body text-xs text-ink-muted mt-0.5">
              Añade la app a tu dispositivo para acceder sin el navegador.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded text-ink-muted/50 hover:text-ink-muted transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setDismissed(true)}
            className="flex-1 py-1.5 rounded border border-gold/15 font-ui text-xs text-ink-muted hover:bg-parchment transition-colors"
          >
            Ahora no
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 py-1.5 rounded bg-gold/10 border border-gold/30 font-ui text-xs font-semibold text-gold-dim hover:bg-gold-soft transition-colors flex items-center justify-center gap-1.5"
          >
            <Download size={11} />
            Instalar
          </button>
        </div>
      </div>
    </div>
  )
}
