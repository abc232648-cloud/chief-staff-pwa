const BUILD_ID = 'development';
const BUILD_ASSETS = [];
const CACHE_PREFIX = 'chief-staff-shell-';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const shell = suffix => `${SCOPE_PATH}${suffix}`;
const APP_SHELL = [shell('/'), shell('/index.html'), shell('/manifest.webmanifest'), shell('/icon.svg')];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL.concat(BUILD_ASSETS))));
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

// Device alerts contain no private payload and never open an arbitrary URL.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* Generic fallback. */ }
  const tag = typeof payload.tag === 'string' && /^chief-device-[0-9]+$/.test(payload.tag) ? payload.tag : 'chief-device-update';
  event.waitUntil(self.registration.showNotification('Farm Agent update', { body: 'Sign in to view your update.', tag, data: { url: '/staff/' } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/staff/'));
});
