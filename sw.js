/* Offline support for the Learning Hub.
   - Your own pages and pictures are saved the first time they load.
   - The Tailwind script and Google Fonts are saved too, so the layout survives going offline.
   Bump VER when you want every tablet to refresh its saved copy. */
const VER = 'learning-hub-v2';
const CORE = ['./', 'index.html', 'manifest.json', 'lessons.json', 'shared/safe-storage.js'];   // lessons and pictures are added from lessons.json
const CDN = [
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://fonts.googleapis.com/css2?family=Quicksand:wght@500;700;800&family=Fredoka:wght@600;700;800&family=Kalam:wght@700&family=Cinzel:wght@700;900&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);
    await Promise.allSettled(CORE.map(u => c.add(u)));
    try {   // every lesson and picture listed in lessons.json, so all pages work offline
      const list = await (await fetch('lessons.json', { cache: 'no-cache' })).json();
      await Promise.allSettled([...(list.lessons || []), ...(list.assets || [])].map(u => c.add(u)));
    } catch (_) {}
    await Promise.allSettled(CDN.map(async u => { const r = await fetch(new Request(u, { mode: 'no-cors' })); await c.put(u, r); }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VER) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !/^https?:/.test(req.url) || req.headers.has('range')) return;
  const url = new URL(req.url);
  const isPage = req.mode === 'navigate' || (url.origin === location.origin && (url.pathname.endsWith('.html') || url.pathname.endsWith('lessons.json')));
  if (isPage) {   // pages: newest copy when online, saved copy when offline
    e.respondWith((async () => {
      try { const r = await fetch(req); const c = await caches.open(VER); c.put(req, r.clone()); return r; }
      catch (_) { return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('index.html')) || Response.error(); }
    })());
    return;
  }
  // everything else: show the saved copy straight away, refresh it quietly in the background
  e.respondWith((async () => {
    const c = await caches.open(VER);
    const hit = await c.match(req);
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});
