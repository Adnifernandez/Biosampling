const STATIC_CACHE = "bio-static-v1";
const PAGE_CACHE = "bio-pages-v5";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo mismo origen
  if (url.origin !== self.location.origin) return;
  // API y auth → siempre red
  if (url.pathname.startsWith("/api/") || url.pathname === "/login") return;

  // Next.js static assets (inmutables, tienen hash en el nombre) → cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(hit => hit || fetch(request).then(res => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // Otros recursos de Next.js (chunks dinámicos) → red primero + cache
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) caches.open(STATIC_CACHE).then(c => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Navegación de páginas → red primero, cache como fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) caches.open(PAGE_CACHE).then(c => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request))
    );
  }
});
