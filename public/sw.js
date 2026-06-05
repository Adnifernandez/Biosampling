const STATIC_CACHE = "bio-static-v3";
const PAGES_CACHE  = "bio-pages-v3";

// Pages cached immediately on install (these are public / don't need auth)
const PRECACHE = [
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.json",
];

// ── Install ──
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(PAGES_CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: delete old caches ──
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

// ── Fetch ──
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // Never cache: API, auth endpoints
  if (url.pathname.startsWith("/api/")) return;

  // ── 1. Next.js static chunks (JS/CSS with content hash) → Cache-First ──
  //    These never change, so once cached they load instantly forever.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        try {
          const res = await fetch(e.request);
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        } catch {
          return hit ?? new Response("", { status: 504 });
        }
      })
    );
    return;
  }

  // Skip non-static _next/ (HMR, webpack, etc.)
  if (url.pathname.startsWith("/_next/")) return;

  // ── 2. App pages → Stale-While-Revalidate ──
  //    Serve cached page immediately (fast!), refresh cache in background.
  //    If offline and no cache yet → show offline.html.
  e.respondWith(
    caches.open(PAGES_CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);

      // Background network fetch
      const networkPromise = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) {
        // Serve cache immediately, update in background
        networkPromise.catch(() => {});
        return cached;
      }

      // No cache → wait for network, fallback to offline page
      const netRes = await networkPromise;
      if (netRes) return netRes;

      // Truly offline with no cached version
      const offlinePage = await cache.match("/offline.html");
      return offlinePage ?? new Response("Sin conexión", { status: 503 });
    })
  );
});
