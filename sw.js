const CACHE = "loneisle-cache-v68";
const ASSETS = [
  "./", "./index.html", "./style.css", "./cozy.css", "./app.js", "./cozy.js", "./villagers.js", "./nature.js", "./quests.js", "./manifest.json",
  "./icons/favicon-32.png", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-192-maskable.png", "./icons/icon-512-maskable.png"
].concat(
  ["sawmill","farm","mine","house","dock","cow","pig","bull","townhouse","restaurant","townshop","lantern","flowers","bench","campfire","fountain","gazebo"].flatMap((n) => ["./sprites/day/" + n + ".webp", "./sprites/night/" + n + ".webp"])
).concat(["0","1","2","3"].map((n) => "./sprites/scatter/s" + n + ".webp")).concat(
  ["wood","food","stone","meat","fish","gold","r0","r1","r2","r3","r4","r5","k0","k1","k2"].map((n) => "./sprites/chars/" + n + ".webp")
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

// Offline-first: everything is served from cache; the network only refreshes it.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("version.json")) {
    event.respondWith(fetch(req).catch(() => new Response('{"build":0}', { headers: { "Content-Type": "application/json" } })));
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
