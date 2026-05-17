const CACHE_NAME = "punto-neutro-v2";
const PRECACHE_URLS = ["/icon-192.png", "/icon-512.png", "/punto-neutro-logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;

  const url = new URL(event.request.url);
  const isHTML = event.request.mode === "navigate" || event.request.destination === "document";
  const isHashedAsset = /\/assets\/.+\.[a-f0-9]{8,}\./i.test(url.pathname);

  // HTML and non-hashed assets: always go to network, no cache fallback
  // (prevents serving stale index.html that points to deleted JS bundles)
  if (isHTML || (!isHashedAsset && !PRECACHE_URLS.includes(url.pathname))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Hashed assets and precached icons: network-first, cache fallback for offline
  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request).then((r) => r || new Response("Offline", { status: 503 })))
  );
});
