// Taraney service worker. Pages: network first, cache fallback, then /offline/.
// Build assets: cache first. Search index: stale while revalidate.
// Audio: served from 'taraney-audio' when saved for offline, with Range support for seeking.
const SHELL = 'taraney-shell-v1';
const PAGES = 'taraney-pages';
const AUDIO = 'taraney-audio';
const PRECACHE = ['/', '/explore/', '/library/', '/offline/', '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('taraney-shell-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function rangeResponse(req, cached) {
  const range = req.headers.get('range');
  if (!range) return cached;
  const buf = await cached.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const start = m && m[1] ? Number(m[1]) : 0;
  const end = m && m[2] ? Number(m[2]) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { 'content-type': cached.headers.get('content-type') || 'audio/mp4', 'content-range': `bytes ${start}-${end}/${buf.byteLength}`, 'accept-ranges': 'bytes', 'content-length': String(end - start + 1) },
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/api/auth')) return;
  if (url.pathname.startsWith('/stock-videos/')) return;

  // Audio saved for offline
  if (url.pathname.startsWith('/api/media/') || url.pathname.startsWith('/samples/')) {
    e.respondWith(caches.open(AUDIO).then((c) => c.match(url.pathname)).then((hit) => (hit ? rangeResponse(req, hit) : fetch(req))));
    return;
  }
  if (url.pathname.startsWith('/api/')) return;

  // Hashed build assets and fonts never change
  if (url.pathname.startsWith('/_astro/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  if (url.pathname === '/search-index.json') {
    e.respondWith(caches.open(SHELL).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(PAGES).then((c) => c.match(url.pathname).then((had) => had && c.put(url.pathname, copy)));
      return res;
    }).catch(async () => (await caches.match(url.pathname)) || (await caches.match('/offline/'))));
  }
});
