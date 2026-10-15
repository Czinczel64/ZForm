
const ROOT = new URL('./', self.location).pathname;
const CACHE = 'zform-shell-v3';
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([ROOT,`${ROOT}manifest.webmanifest`,`${ROOT}icon.svg`]))));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('zform-shell-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const sameOrigin = new URL(event.request.url).origin === self.location.origin;
  if (!sameOrigin) return;
  const navigation = event.request.mode === 'navigate';
  event.respondWith((navigation ? fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(ROOT, response.clone()));
    return response;
  }).catch(() => caches.match(ROOT)) : caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }))));
});

