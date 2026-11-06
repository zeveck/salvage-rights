// sw.js: offline play. The GitHub Pages workflow stamps VERSION with the commit
// and fills FILES with everything in the game folder. Installing caches the core
// and fails if any of it is missing, so a flaky update leaves the working version
// in place. The page asks for the rest on every launch, so gaps fill themselves.
'use strict';
const VERSION = '__BUILD__';
const FILES = [/*__FILES__*/];
const PREFIX = 'salvage-rights-';
const CACHE = PREFIX + VERSION;
const isCore = (f) => !f.startsWith('assets/') || f.startsWith('assets/ui/') || f.startsWith('assets/tiles/trim')
  || /assets\/models\/(chassis-crate|scrapwheel|ram)\./.test(f) || f.startsWith('assets/bg/bowl') || f.startsWith('assets/tiles/bowl-floor') || f.startsWith('assets/tiles/garage-wall');

self.addEventListener('install', (event) => {
  const core = ['./', ...FILES.filter(isCore)];
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(core.map((url) => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function post(pct) {
  for (const c of await self.clients.matchAll()) c.postMessage({ offline: pct });
}

let filling = null;
async function fillRest() {
  if (!FILES.length) return; // A local copy caches as it goes.
  const cache = await caches.open(CACHE);
  let have = 0;
  for (const f of FILES) {
    if (await cache.match(f)) have++;
    else {
      try {
        const res = await fetch(new Request(f, { cache: 'reload' }));
        if (res.ok) { await cache.put(f, res); have++; }
      } catch { /* picked up on the next launch */ }
    }
    if (have % 8 === 0) await post(Math.floor((have / FILES.length) * 100));
  }
  await post(Math.floor((have / FILES.length) * 100));
}

self.addEventListener('message', (event) => {
  if (event.data !== 'fill') return;
  if (!filling) filling = fillRest().finally(() => { filling = null; });
  event.waitUntil(filling);
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const key = req.mode === 'navigate' ? './' : req;
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(key, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  }))));
});
