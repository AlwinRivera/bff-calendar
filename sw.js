/* bff calendar service worker — makes the app installable and quick to open.
   Network-first for the app's own files (so updates show up right away),
   cached copy as a fallback when offline. Never touches Supabase/Cloudflare calls. */
const CACHE = 'bff-shell-v2';
const SHELL = ['./', 'index.html', 'app.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cdn = url.hostname === 'cdn.jsdelivr.net';   // the database library — keep a copy so the app can open offline
  if (url.origin !== location.origin && !cdn) return; // let Supabase, Cloudflare and fonts pass straight through
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html')))
  );
});
