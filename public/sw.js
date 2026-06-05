// Cache names — bump STATIC version only when JS/CSS chunks change significantly
const STATIC_CACHE = "bio-static-v2";   // Next.js JS/CSS chunks (content-hashed, safe forever)
const PAGES_CACHE  = "bio-pages-v2";    // HTML pages (stale-while-revalidate)

const SHELL = [
  "/proyectos",
  "/campanas",
  "/estaciones",
  "/ocurrencias",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ── Install: pre-cache key pages so they load offline from the start ──
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(PAGES_CACHE).then((c) =>
      c.addAll(SHELL.map((url) => new Request(url, { credentials: "same-origin" })))
        .catch(() => {}) // don't fail install if a page is unreachable
    )
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ──
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== PAGES_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: three-tier strategy ──
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // 1. Never cache: API routes, server actions, auth endpoints
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/api/auth/")
  ) return;

  // 2. Cache-FIRST for Next.js static chunks (JS/CSS with content hashes)
  //    These filenames include a hash — once cached they never need revalidation.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      })
    );
    return;
  }

  // 3. Skip non-static _next/ routes (webpack hmr, etc.)
  if (url.pathname.startsWith("/_next/")) return;

  // 4. Stale-While-Revalidate for all app pages
  //    → Serve cached HTML instantly, refresh cache in background.
  //    → Falls back to cache when offline.
  e.respondWith(
    caches.open(PAGES_CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);

      const networkFetch = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached ?? new Response("Offline", { status: 503 }));

      // Return cached immediately if available, background-fetch anyway
      return cached ?? networkFetch;
    })
  );
});
