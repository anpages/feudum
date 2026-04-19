import { useState, useEffect } from 'react'
import { http } from '@/shared/services/http'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export type PushState = 'unsupported' | 'loading' | 'unsubscribed' | 'subscribed' | 'denied'

function initialPushState(): PushState {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'loading'
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  return 'loading'
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>(initialPushState)

  useEffect(() => {
    if (state !== 'loading') return
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setState(sub ? 'subscribed' : 'unsubscribed'))
      .catch(() => setState('unsubscribed'))
  }, [state])

  async function subscribe() {
    setState('loading')
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState('denied'); return }

      const { publicKey } = await http.get<{ publicKey: string }>('/push/vapid-public-key')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      })
      await http.post('/push/subscribe', sub.toJSON())
      setState('subscribed')
    } catch {
      setState('unsubscribed')
    }
  }

  async function unsubscribe() {
    setState('loading')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await http.post('/push/subscribe', { endpoint: sub.endpoint, _delete: true })
        await sub.unsubscribe()
      }
      setState('unsubscribed')
    } catch {
      setState('subscribed')
    }
  }

  return { state, subscribe, unsubscribe }
}
