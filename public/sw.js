// Offline reading of the 講義 (and their 自我檢查卡): the handouts and the pages that show them are
// kept in a cache. Network first, so a deploy shows up at once; the cached
// copy is only used when the network fails (no signal on the bus).
// Everything else (videos, /api, other sites) goes straight to the network.
const CACHE = 'handouts-v1';

self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
    // every handout, so a chapter never opened before can still be read offline
    try {
      const r = await fetch('/handouts/index.json', {cache: 'no-cache'});
      if (!r.ok || !isData(r)) return;
      const cache = await caches.open(CACHE);
      await cache.put('/handouts/index.json', r.clone());
      const index = await r.json();
      for (const ch of Object.keys(index)) {
        const m = await fetch('/handouts/' + ch + '.md');
        if (m.ok && isData(m)) await cache.put('/handouts/' + ch + '.md', m);
        if (!index[ch].cards) continue;
        const c = await fetch('/handouts/' + ch + '.cards.json');
        if (c.ok && isData(c)) await cache.put('/handouts/' + ch + '.cards.json', c);
      }
      const l = await fetch('/handouts/links.json');
      if (l.ok && isData(l)) await cache.put('/handouts/links.json', l);
    } catch (err) {}
  })());
});

// a login page (expired session) must never be cached in place of a handout
function isData(r){ return !/text\/html/.test(r.headers.get('content-type') || ''); }
function wanted(url, req){
  if (url.origin !== self.location.origin || req.method !== 'GET') return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/handouts/')) return 'data';
  if (/^\/study\/[\w-]+\/\d+\/?$/.test(url.pathname) || url.pathname === '/review.html') return 'page';
  if (/\.(js|css)$/.test(url.pathname) || url.pathname === '/data.js') return 'data';
  return false;
}
self.addEventListener('fetch', function(e){
  const url = new URL(e.request.url), kind = wanted(url, e.request);
  if (!kind) return;
  e.respondWith((async function(){
    const cache = await caches.open(CACHE);
    // pages are one entry per path (the ?v=…&t=… query only picks a view)
    const key = kind === 'page' ? url.origin + url.pathname : e.request;
    try {
      const r = await fetch(e.request);
      const fine = r.ok && !r.redirected && (kind === 'page' ? /text\/html/.test(r.headers.get('content-type') || '') : isData(r));
      if (fine) cache.put(key, r.clone());
      return r;
    } catch (err) {
      const hit = await cache.match(key, {ignoreSearch: kind === 'page'});
      if (hit) return hit;
      throw err;
    }
  })());
});
