const CACHE = "candy-princess-big-number-v5";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/config.js")) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => new Response("", { status: 404 })));
    return;
  }

  const isCoreAsset =
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/styles.css") ||
    req.mode === "navigate";

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      if (isCoreAsset) {
        try {
          const fresh = await fetch(req);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          return (await cache.match(req)) || (await cache.match("./index.html"));
        }
      }

      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return (await cache.match("./index.html")) || new Response("offline", { status: 503 });
      }
    })()
  );
});
