// Service worker: ginagawang gumana offline ang app mismo.
// (Ang mga kanta ay nasa IndexedDB, hindi dito.)
const CACHE = 'worship-player-v2';
const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'eq.js', 'artists.js',
  'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.headers.has('range')) return;              // audio streaming: hayaang browser ang bahala
  if (url.pathname.includes('/songs/')) return;      // hindi i-cache dito ang audio

  // Network-first para sa catalog (para laging bago), cache fallback pag offline
  if (url.pathname.endsWith('catalog.json')) {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Stale-while-revalidate para sa app files
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return r;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
