'use strict';
// Guarda o aplicativo no aparelho para abrir sem internet. As regras e o modelo funcionam offline;
// as consultas (RDAP, BrasilAPI, listas) só com internet e nunca passam por este cache.
const CACHE = 'egolpe-app-v1';
const ARQUIVOS = ['./', 'index.html', 'app.css', 'app.js', 'ponte.js', 'manifest.webmanifest',
  'nucleo/background.js', 'nucleo/modelo.js', 'nucleo/pessoa.js', 'nucleo/ml/modelo.json',
  'nucleo/dados/consumidor.json', 'nucleo/icons/reclameaqui.png', 'icones/icone-192.png', 'icones/icone-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Primeiro a rede (para pegar versões novas); sem internet, o que está guardado.
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone();
    if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, copia));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
