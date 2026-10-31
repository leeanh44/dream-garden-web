/* Service worker của Dream's Garden.
 * - Tài nguyên build (/_next/static, tên có hash) → cache-first (trừ script Web Worker).
 * - Điều hướng trang → luôn lấy mạng (dữ liệu cần đăng nhập), mất mạng thì hiện /offline.html.
 * - Không đụng tới Supabase (API, ảnh) — ảnh đã có HTTP cache + signed URL bền.
 */
const VERSION = 'v2'
const STATIC_CACHE = `dg-static-${VERSION}`
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key.startsWith('dg-') && key !== STATIC_CACHE).map((key) => caches.delete(key)))
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return (await event.preloadResponse) || (await fetch(request))
        } catch {
          return (await caches.match('/offline.html')) || Response.error()
        }
      })(),
    )
    return
  }

  // Script của Web Worker: Turbopack truyền danh sách chunk qua `#params=…` mà Cache API bỏ qua phần `#`
  // → cache-first sẽ chạy worker với chunk của bản build cũ. Luôn lấy từ mạng (HTTP cache vẫn áp dụng).
  if (request.destination === 'worker' || request.destination === 'sharedworker' || url.pathname.includes('turbopack-worker')) {
    return
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE)
          cache.put(request, response.clone())
        }
        return response
      })(),
    )
  }
})
