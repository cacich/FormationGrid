// Offline support. Pages are network-first so a new release shows up on the
// next online visit; hashed build assets are cache-first. Only same-origin
// requests are handled (Google Fonts fall back to system fonts offline).
const CACHE = 'zhen-grid-v1';
const SHELL = ['./manifest.webmanifest', './icon.svg', './icons/icon-192.png', './icons/icon-512.png'];

const assetsIn = (html) =>
  [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map((m) => new URL(m[1], self.registration.scope).href);

// Cache the page and everything it references; drop assets from older releases.
async function store(response) {
  const cache = await caches.open(CACHE),
    html = await response.clone().text(),
    assets = assetsIn(html);
  await cache.put(self.registration.scope, response);
  await cache.addAll(assets.filter((url) => url));
  for (const request of await cache.keys())
    if (request.url.includes('/assets/') && !assets.includes(request.url)) await cache.delete(request);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      await (await caches.open(CACHE)).addAll(SHELL);
      await store(await fetch(self.registration.scope, { cache: 'no-store' }));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) event.waitUntil(store(response.clone()));
          return response;
        })
        .catch(
          async () => (await caches.match(self.registration.scope, { ignoreVary: true })) ?? Response.error(),
        ),
    );
    return;
  }
  // Module scripts are CORS requests; ignore Vary so they still hit the cache.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
          }
          return response;
        }),
    ),
  );
});
