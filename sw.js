/* DLR — service worker (v1). Hanya menyimpan cangkang aplikasi agar bisa dibuka tanpa internet.
   Permintaan ke Google Apps Script TIDAK diintervensi, jadi sinkron data tetap persis seperti semula. */
const VERSI = 'dlr-pwa-v1';
const SHELL = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const INDEX = new Request('index.html');

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSI).then(function (c) {
      return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== VERSI; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // API Google Apps Script: biarkan langsung ke jaringan
  if (url.hostname === 'script.google.com' || url.hostname.endsWith('googleusercontent.com')) return;

  if (req.mode === 'navigate') { e.respondWith(halamanJaringanDulu(e)); return; }

  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (font || url.origin === location.origin) e.respondWith(segarkanDiLatar(req));
});

// Halaman utama: ambil versi terbaru bila jaringan cepat (maks 4 detik), kalau tidak pakai salinan tersimpan.
async function halamanJaringanDulu(e) {
  const c = await caches.open(VERSI);
  const cached = await c.match(INDEX);
  const net = fetch(e.request).then(function (r) {
    if (r && r.ok) c.put(INDEX, r.clone());
    return r;
  });
  e.waitUntil(net.catch(function () {}));
  if (!cached) return net;
  return Promise.race([
    net.catch(function () { return cached; }),
    new Promise(function (res) { setTimeout(function () { res(cached); }, 4000); })
  ]);
}

// Aset lain & font: tampilkan salinan tersimpan, perbarui diam-diam di latar.
async function segarkanDiLatar(req) {
  const c = await caches.open(VERSI);
  const cached = await c.match(req);
  const net = fetch(req).then(function (r) {
    if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
    return r;
  }).catch(function () { return cached; });
  return cached || net;
}
