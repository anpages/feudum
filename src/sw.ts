/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

// Activate new SW immediately instead of waiting for all tabs to close.
// This ensures stale chunk references (old index.html → old hashes) get replaced fast.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event: ExtendableEvent) =>
  event.waitUntil(self.clients.claim())
)

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA fallback — skip /api/*
// Precache already handles JS/CSS assets; a separate CacheFirst for scripts
// would create stale-hash conflicts on new deploys, so we don't register one.
const handler = createHandlerBoundToURL('/index.html')
const navRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//],
})
registerRoute(navRoute)

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? 'Feudum'
  const options: NotificationOptions = {
    body:  data.body  ?? '',
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    tag:   data.tag ?? 'feudum',
    data:  { url: data.url ?? '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url: string = (event.notification.data as { url: string })?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
