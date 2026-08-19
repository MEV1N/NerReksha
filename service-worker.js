const CACHE_NAME = 'nerreksha-v3';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './map.js',
    './offline.js',
    './data.js',
    './gps.js',
    './search.js',
    './routing.js',
    './offline-map.js',
    './offline-region.js',
    './report.js',
    './geo/distance.js',
    './geo/spatial-index.js',
    './geo/graph.js',
    './geo/astar.js',
    './manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.css',
    'https://unpkg.com/leaflet-control-geocoder/dist/Control.Geocoder.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                await Promise.all(APP_SHELL.map(async url => {
                    try {
                        await cache.add(url);
                    } catch (error) {
                        console.warn('Could not cache optional resource:', url);
                    }
                }));
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        (async () => {
            if (event.request.method !== 'GET') return fetch(event.request);

            const cached = await caches.match(event.request);
            const requestUrl = new URL(event.request.url);
            const isMapTile = requestUrl.hostname.includes('tile.openstreetmap.org');
            const isDataFile = requestUrl.pathname.includes('/data/');
            const isAppShell = requestUrl.origin === self.location.origin;

            // Cache First for map tiles and local data files to ensure fast offline performance
            if (isMapTile || isDataFile || isAppShell) {
                if (cached) {
                    // Update cache in background for app shell (Stale-While-Revalidate)
                    if (isAppShell && !isDataFile) {
                        fetch(event.request).then(response => {
                            if (response.ok) {
                                caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
                            }
                        }).catch(() => {});
                    }
                    return cached;
                }
            } else {
                if (cached) return cached;
            }

            try {
                const response = await fetch(event.request);
                if (response.ok || response.type === 'opaque') {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(event.request, response.clone());
                }
                return response;
            } catch (error) {
                if (cached) return cached;
                if (event.request.mode === 'navigate') return caches.match('./index.html');
                throw error;
            }
        })()
    );
});
