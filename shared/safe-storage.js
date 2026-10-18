/* Shared safety layer for every lesson page and the hub.
   1. If the browser's small localStorage is full, writing is kept in IndexedDB instead of being lost silently.
   2. Asks the browser to keep the saved data (not clear it when space is short).
   3. Early picture fallbacks, so a missing image never throws an error.
   4. HubBackup.export() / HubBackup.import(file): one file with all writing and progress on this tablet. */
(function () {
  if (window.__hubSafeStorage) return; window.__hubSafeStorage = true;

  /* ---------- picture fallbacks (a page's own version replaces these once it loads) ---------- */
  const svg = e => "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><circle cx='70' cy='70' r='65' fill='%23FEF3C7' stroke='%23D97706' stroke-width='4'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-size='56'>" + e + "</text></svg>";
  window.handleImageFallback = window.handleImageFallback || function (i) { i.onerror = null; i.src = svg('📚'); };
  window.handleImgFallback = window.handleImgFallback || window.handleImageFallback;
  window.handleAvatarFallback = window.handleAvatarFallback || function (i, e) { i.onerror = null; i.src = svg(e || '⭐'); };

  /* ---------- localStorage with overflow ---------- */
  let ls; try { ls = window.localStorage; } catch (_) { return; }
  const P = Storage.prototype, nSet = P.setItem, nGet = P.getItem, nRemove = P.removeItem;
  const overflow = new Map();
  const OVF_DB = 'hub_overflow_db';
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((res, rej) => {
    if (!window.indexedDB) { rej(); return; }
    const r = indexedDB.open(OVF_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }).catch(() => null));
  const tx = (mode, fn) => db().then(d => d ? new Promise(res => { try { const t = d.transaction('kv', mode); const q = fn(t.objectStore('kv')); t.oncomplete = () => res(q ? q.result : true); t.onerror = t.onabort = () => res(null); } catch (_) { res(null); } }) : null);
  const idbPut = (k, v) => tx('readwrite', s => { s.put(v, k); });
  const idbDel = k => tx('readwrite', s => { s.delete(k); });
  tx('readonly', s => s.getAllKeys()).then(keys => { (keys || []).forEach(k => tx('readonly', s => s.get(k)).then(v => { if (typeof v === 'string' && !overflow.has(k)) overflow.set(k, v); })); });

  let warned = false;
  function warn() {
    if (warned || !document.body) return; warned = true;
    const d = document.createElement('div');
    d.textContent = 'Storage is nearly full. Your writing is still kept safely. Open the hub and tap 💾 Backup to save a copy.';
    d.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;background:#92400E;color:#fff;padding:10px 18px;border-radius:14px;font:800 15px system-ui,sans-serif;max-width:90vw;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.35)';
    document.body.appendChild(d); setTimeout(() => d.remove(), 6000);
  }
  P.setItem = function (k, v) {
    if (this !== ls) return nSet.call(this, k, v);
    k = String(k); v = String(v);
    try { nSet.call(this, k, v); if (overflow.has(k)) { overflow.delete(k); idbDel(k); } }
    catch (e) { overflow.set(k, v); idbPut(k, v); warn(); }
  };
  P.getItem = function (k) { if (this === ls) { k = String(k); if (overflow.has(k)) return overflow.get(k); } return nGet.call(this, k); };
  P.removeItem = function (k) { if (this === ls) { k = String(k); if (overflow.has(k)) { overflow.delete(k); idbDel(k); } } return nRemove.call(this, k); };
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  /* ---------- backup and restore ---------- */
  const blobToUrl = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  const ser = async v => {
    if (v instanceof Blob) return { __blob: await blobToUrl(v) };
    if (Array.isArray(v)) return Promise.all(v.map(ser));
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = await ser(v[k]); return o; }
    return v;
  };
  const de = async v => {
    if (v && typeof v === 'object' && v.__blob) return (await fetch(v.__blob)).blob();
    if (Array.isArray(v)) return Promise.all(v.map(de));
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = await de(v[k]); return o; }
    return v;
  };
  const openDb = (name, ver) => new Promise((res, rej) => { const r = ver ? indexedDB.open(name, ver) : indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const dumpStore = (d, store) => new Promise(res => {
    const t = d.transaction(store, 'readonly'), os = t.objectStore(store), rows = [];
    const c = os.openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { rows.push([cur.key, cur.value]); cur.continue(); } };
    t.oncomplete = () => res({ keyPath: os.keyPath, autoIncrement: os.autoIncrement, rows }); t.onerror = () => res({ rows: [] });
  });
  async function exportAll() {
    const data = { app: 'learning-hub', version: 1, created: new Date().toISOString(), local: {}, idb: {} };
    for (let i = 0; i < ls.length; i++) { const k = ls.key(i); data.local[k] = nGet.call(ls, k); }
    overflow.forEach((v, k) => { data.local[k] = v; });
    if (indexedDB.databases) {
      for (const info of await indexedDB.databases()) {
        if (!info.name || info.name === OVF_DB) continue;
        try {
          const d = await openDb(info.name), out = { version: d.version, stores: {} };
          for (const s of Array.from(d.objectStoreNames)) { const dump = await dumpStore(d, s); out.stores[s] = { keyPath: dump.keyPath, autoIncrement: dump.autoIncrement, rows: await Promise.all(dump.rows.map(async ([k, v]) => [k, await ser(v)])) }; }
          d.close(); data.idb[info.name] = out;
        } catch (_) {}
      }
    }
    const file = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(file);
    a.download = 'learning-hub-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return { keys: Object.keys(data.local).length, dbs: Object.keys(data.idb).length, bytes: file.size };
  }
  async function ensureDb(name, stores) {
    let d = await openDb(name);
    const missing = Object.keys(stores).filter(s => !d.objectStoreNames.contains(s));
    if (!missing.length) return d;
    const next = d.version + 1; d.close();
    return new Promise((res, rej) => {
      const r = indexedDB.open(name, next);
      r.onupgradeneeded = () => missing.forEach(s => { const o = stores[s]; const opt = {}; if (o.keyPath != null) opt.keyPath = o.keyPath; if (o.autoIncrement) opt.autoIncrement = true; r.result.createObjectStore(s, opt); });
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function importAll(file) {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'learning-hub') throw new Error('This is not a Learning Hub backup file.');
    let keys = 0, rows = 0;
    for (const k of Object.keys(data.local || {})) { ls.setItem(k, data.local[k]); keys++; }
    for (const name of Object.keys(data.idb || {})) {
      const info = data.idb[name], d = await ensureDb(name, info.stores);
      for (const s of Object.keys(info.stores)) {
        const list = info.stores[s].rows, vals = await Promise.all(list.map(async ([k, v]) => [k, await de(v)]));
        await new Promise(res => { const t = d.transaction(s, 'readwrite'), os = t.objectStore(s); vals.forEach(([k, v]) => { try { os.keyPath != null ? os.put(v) : os.put(v, k); } catch (_) {} }); t.oncomplete = t.onerror = t.onabort = () => res(); });
        rows += vals.length;
      }
      d.close();
    }
    return { keys, rows };
  }
  window.HubBackup = { export: exportAll, import: importAll };
})();
