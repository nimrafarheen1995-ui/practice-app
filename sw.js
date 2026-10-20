/* Offline support for the Learning Hub.
   - Core files, lessons, and pictures from lessons.json are pre-cached.
   - Pages use network-first with offline fallback.
   - Assets use cache-first with stale-while-revalidate.
   Bump VER whenever you update lessons or code to force a refresh. */
const VER = 'learning-hub-v4';

const CORE = [
  './',
  'index.html',
  'manifest.json',
  'lessons.json',
  'shared/safe-storage.js',
  'shared/notebook.css',
  'shared/notebook.js'
];

const CDN = [
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'
];

// Helper to safely cache a URL without breaking installation if one is missing
async function safeCacheAdd(cache, url) {
  try {
    const req = new Request(url, { cache: 'no-cache' });
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(req, res);
    }
  } catch (_) {}
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VER);

    // 1. Pre-cache core shell files
    for (const u of CORE) {
      await safeCacheAdd(c, u);
    }

    // 2. Fetch lessons.json and pre-cache all lessons and images
    try {
      const res = await fetch('lessons.json', { cache: 'no-cache' });
      if (res && res.ok) {
        const clone = res.clone();
        const c2 = await caches.open(VER);
        await c2.put('lessons.json', clone);
        const list = await res.json();
        const urls = [...(list.lessons || []), ...(list.assets || [])];
        // cache lessons sequentially to avoid burst
        for (const u of urls) {
          await safeCacheAdd(c, u);
        }
      }
    } catch (_) {}

    // 3. Pre-cache CDN scripts (no-cors)
    for (const u of CDN) {
      try {
        const req = new Request(u, { mode: 'no-cors' });
        const r = await fetch(req);
        if (r) await c.put(req, r);
      } catch (_) {}
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VER).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !/^https?:/.test(req.url) || req.headers.has('range')) return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === location.origin;
  
  const isPage = req.mode === 'navigate' || 
                 (isSameOrigin && (
                   url.pathname.endsWith('.html') || 
                   url.pathname.endsWith('lessons.json') || 
                   url.pathname === '/' ||
                   url.pathname.endsWith('/')
                 ));

  // Strategy A: Pages & Manifests (Network First, Cache Fallback)
  if (isPage) {
    e.respondWith((async () => {
      try {
        const networkRes = await fetch(req, { cache: 'no-store' });
        if (networkRes && networkRes.ok) {
          const c = await caches.open(VER);
          c.put(req, networkRes.clone());
        }
        return networkRes;
      } catch (_) {
        // Try exact match first, then ignoreSearch fallback
        let cached = await caches.match(req);
        if (!cached) cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;

        // Fallback to index.html for navigation
        const fallback = (await caches.match('./')) || 
                         (await caches.match('index.html')) || 
                         (await caches.match('/')) ||
                         (await caches.match('index.html', { ignoreSearch: true }));
        return fallback || Response.error();
      }
    })());
    return;
  }

  // Strategy B: Assets & Images (Cache First, Background Update - Stale While Revalidate)
  e.respondWith((async () => {
    const c = await caches.open(VER);
    let hit = await c.match(req);
    if (!hit) hit = await c.match(req, { ignoreSearch: true });

    const fetchAndCache = fetch(req).then(networkRes => {
      if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
        c.put(req, networkRes.clone());
      }
      return networkRes;
    }).catch(() => null);

    // Return cached immediately, update in background
    if (hit) {
      fetchAndCache; // background update
      return hit;
    }
    
    // No cache, wait for network
    const networkRes = await fetchAndCache;
    return networkRes || Response.error();
  })());
});
