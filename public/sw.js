const CACHE_NAME = "mukgall-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Only handle GET requests
  if (event.request.method !== "GET") {
    return;
  }

  // 2. NEVER intercept page navigation requests (prevents ERR_CACHE_MISS and SSR redirect bugs)
  if (event.request.mode === "navigate") {
    return;
  }

  // 3. Skip API, Next.js Server Actions, Next.js RSC requests, Supabase, and extensions
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("_next/data") ||
    url.searchParams.has("_rsc") ||
    url.hostname.includes("supabase.co") ||
    url.protocol.startsWith("chrome-extension")
  ) {
    return;
  }

  // 4. Only cache static immutable assets (icons, static JS/CSS, images, fonts)
  const isStaticAsset =
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".ico") ||
    url.pathname === "/manifest.json";

  if (!isStaticAsset) {
    return;
  }

  // Stale-While-Revalidate for static assets only
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/chat";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

