// Saves the whole app on the phone so it works with no signal.
const CACHE = 'bike-korea-v12';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'data.js', 'words.js', 'food.js', 'photos.js', 'offline.js', 'icons.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => {
  // 'reload' skips the browser's HTTP cache so a new version never mixes in an old copy of a file
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // only drop old copies of the app itself — downloaded maps, photos and OCR (bk-* caches) must survive updates
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('bike-korea-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) {
        // refresh in the background when online
        fetch(e.request).then((r) => { if (r && r.ok) caches.open(CACHE).then((c) => c.put(e.request, r)); }).catch(() => {});
        return hit;
      }
      return fetch(e.request).catch(() => (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
