// Sridhi Caller: tiny service worker (makes the app installable + opens offline).
// Network first, so a new version always shows up straight away.
const CACHE = 'sridhi-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET' || !r.url.startsWith(self.location.origin)) return
  e.respondWith(
    fetch(r)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(r, copy))
        return res
      })
      .catch(() => caches.match(r).then((m) => m || caches.match('/')))
  )
})
