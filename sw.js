/* Offline support for the Learning Hub.
   - Core files, lessons, and pictures from lessons.json are pre-cached.
   - Pages use network-first with offline fallback.
   - Assets use cache-first with stale-while-revalidate.
   Bump VER whenever you update lessons or code to force a refresh. */
const VER = 'learning-hub-v2';

const CORE = [
  'index.html',
  'manifest.json',
  'lessons.json',
  'shared/safe-storage.js'
];

const CDN = [
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'
];

// Helper to safely cache a URL
async function safeCacheAdd(cache, url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (res.ok) {
      await cache.put(url, res);
    }
  } catch (_) {
    // Skip failed files without crashing the whole installation
  }
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);

    // 1. Pre-cache core shell files
    await Promise.allSettled(CORE.map(u => safeCacheAdd(c, u)));

    // 2. Fetch lessons.json and pre-cache all lessons and images
    try {
      const res = await fetch('lessons.json', { cache: 'no-cache' });
      if (res.ok) {
        const list = await res.json();
        const urls = [...(list.lessons || []), ...(list.assets || [])];
        await Promise.allSettled(urls.map(u => safeCacheAdd(c, u)));
      }
    } catch (_) {}

    // 3. Pre-cache CDN scripts
    await Promise.allSettled(CDN.map(async u => {
      try {
        const req = new Request(u, { mode: 'no-cors' });
        const r = await fetch(req);
        await c.put(u, r);
      } catch (_) {}
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Delete old cache versions
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !/^https?:/.test(req.url) || req.headers.has('range')) return;

  const url = new URL(req.url);
  const isPage = req.mode === 'navigate' || 
                 (url.origin === location.origin && (url.pathname.endsWith('.html') || url.pathname.endsWith('lessons.json') || url.pathname.endsWith('/')));

  // Strategy A: Pages & Manifests (Network First, Cache Fallback)
  if (isPage) {
    e.respondWith((async () => {
      try {
        const networkRes = await fetch(req);
        if (networkRes && networkRes.ok) {
          const c = await caches.open(VER);
          c.put(req, networkRes.clone());
        }
        return networkRes;
      } catch (_) {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;

        const fallbackIndex = await caches.match('index.html');
        return fallbackIndex || Response.error();
      }
    })());
    return;
  }

  // Strategy B: Assets, Fonts, & Images (Cache First, Background Update)
  e.respondWith((async () => {
    const c = await caches.open(VER);
    const hit = await c.match(req, { ignoreSearch: true });

    const fetchPromise = fetch(req).then(networkRes => {
      if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
        c.put(req, networkRes.clone());
      }
      return networkRes;
    }).catch(() => null);

    return hit || (await fetchPromise) || Response.error();
  })());
});
