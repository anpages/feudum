/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Cache static assets
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style' || request.destination === 'font',
  new CacheFirst({
    cacheName: 'assets-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
)

// SPA fallback — skip /api/*
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
