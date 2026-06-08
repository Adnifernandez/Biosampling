/**
 * Navigates to a URL using Next.js router when online, and falls back to a
 * hard navigation when offline so the service worker can serve cached HTML.
 *
 * router.push() triggers an RSC fetch which fails when there is no network.
 * window.location.href triggers a full navigation that hits the SW page cache.
 */
export function navigate(router: { push: (url: string) => void }, url: string) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    window.location.href = url;
  } else {
    router.push(url);
  }
}
