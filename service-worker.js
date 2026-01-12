const CACHE_NAME = 'controle-horas-v1';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './manifest.webmanifest'
  // Ícones, se quiser:
  // './icon-192.png',
  // './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((resp) => {
      return (
        resp ||
        fetch(event.request).catch(() =>
          // fallback simples pra quando estiver offline e o recurso não estiver em cache
          caches.match('./index.html')
        )
      );
    })
  );
});
