"use client";

import { useEffect } from "react";

/**
 * Intercepts all same-origin link clicks while offline and forces a full
 * page reload so the service worker can serve the cached HTML.
 *
 * Next.js <Link> does client-side routing (RSC fetch) which fails offline.
 * A full navigation (window.location.href) instead lets the SW serve from
 * the pages cache (bio-pages-v4) that was populated while online.
 *
 * Runs in capture phase so it fires before React/Next.js event handlers.
 * Calling e.preventDefault() makes Next.js Link skip its routing logic
 * (it checks e.defaultPrevented), so the only navigation that runs is ours.
 */
export function OfflineNavFix() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navigator.onLine) return;

      const anchor = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";

      // Only intercept same-origin relative paths
      if (!href.startsWith("/") || href.startsWith("//")) return;

      // Skip hash-only navigation and external links
      if (anchor.target === "_blank") return;

      e.preventDefault(); // tells Next.js Link to skip its client-side routing

      // Already on this page? No-op.
      if (window.location.pathname === href.split("?")[0] && !href.includes("?")) return;

      window.location.href = href;
    }

    document.addEventListener("click", handleClick, true); // capture phase
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
