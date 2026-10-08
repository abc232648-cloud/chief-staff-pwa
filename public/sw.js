const CACHE_PREFIX = 'chief-staff-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const shell = suffix => `${SCOPE_PATH}${suffix}`;
const APP_SHELL = [shell('/'), shell('/index.html'), shell('/manifest.webmanifest'), shell('/icon.svg')];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'CHIEF_STAFF_ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (!(url.pathname === SCOPE_PATH || url.pathname.startsWith(`${SCOPE_PATH}/`))) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(shell('/index.html'));
      if (!cached) throw new Error('Offline app shell unavailable');
      return cached;
    }));
    return;
  }

  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (!cached) throw new Error('Offline static asset unavailable');
    return cached;
  }));
});
