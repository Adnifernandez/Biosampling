const STATIC_CACHE = "bio-static-v4";
const PAGES_CACHE  = "bio-pages-v4";

// Always-cached static assets (public, no auth needed)
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

// ── Helpers ──
function isHtml(response) {
  const ct = response.headers.get("Content-Type") || "";
  return ct.includes("text/html");
}

// ── Fetch ──
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  // Skip: API, auth, Next.js internals
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/data/")) return;

  // ── 1. Next.js static chunks (JS/CSS with content hash) → Cache-First ──
  //    Content-hashed filenames never change; once cached they're permanent.
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
          return new Response("", { status: 504 });
        }
      })
    );
    return;
  }

  // Skip other internal Next.js paths (HMR, webpack, RSC headers, etc.)
  if (url.pathname.startsWith("/_next/")) return;

  // ── 2. App pages → only intercept real browser navigations ──
  //    RSC fetches (client-side router) have mode !== "navigate" and carry
  //    Next-Router-State-Tree / RSC headers — we must NOT cache those.
  //    We only cache full HTML responses so offline.html links work correctly.
  if (e.request.mode !== "navigate") return;

  e.respondWith(
    caches.open(PAGES_CACHE).then(async (cache) => {
      // Only serve from cache if it's actually HTML (not RSC payload)
      const cached = await cache.match(e.request);
      if (cached && isHtml(cached)) {
        // Serve immediately; refresh in background when online
        fetch(e.request)
          .then((res) => { if (res.ok && isHtml(res)) cache.put(e.request, res.clone()); })
          .catch(() => {});
        return cached;
      }

      // Cache miss or stale non-HTML entry → fetch from network
      try {
        const res = await fetch(e.request);
        if (res.ok && isHtml(res)) cache.put(e.request, res.clone());
        return res;
      } catch {
        // Truly offline with no valid cached page → serve offline fallback
        const offlinePage = await cache.match("/offline.html");
        return offlinePage ?? new Response("Sin conexión", { status: 503 });
      }
    })
  );
});
