"use client";

// Offline helpers used by the sync triggers (useRobustSync).

export async function runSeedCache() {
  const { seedLocalCache } = await import("@/lib/sync");
  return seedLocalCache();
}

export async function precachePages() {
  if (!("caches" in window)) return;
  const KEY_PAGES = ["/proyectos", "/campanas", "/estaciones", "/ocurrencias", "/offline/registro", "/terreno", "/sincronizacion"];
  try {
    const cache = await caches.open("bio-pages-v4");
    for (const url of KEY_PAGES) {
      try {
        // Request as a navigation (text/html) so Next.js returns the full HTML
        // page instead of an RSC payload. Without this, client-side fetches can
        // cache RSC data under the page URL and break offline navigation.
        const res = await fetch(url, {
          credentials: "same-origin",
          headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.9" },
        });
        if (res.ok) await cache.put(url, res);
      } catch {}
    }
  } catch {}
}
