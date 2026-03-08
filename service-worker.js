const CACHE = 'shadow-survivor-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/hud.css',
  './css/overlays.css',
  './js/game.js',
  './js/player.js',
  './js/enemy.js',
  './js/weapons.js',
  './js/data.js',
  './js/config.js',
  './js/auth.js',
  './js/souls.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/map_floor.jpg',
  './assets/map_cemetery.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network first for API calls, cache first for assets
  if (e.request.url.includes('workers.dev')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
  }
});
