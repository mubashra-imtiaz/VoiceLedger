const CACHE_NAME = "voiceledger-cache-v1";
const ASSETS_TO_CACHE = [
    "/",
    "/manifest.json",
    "/favicon.ico"
];

// Installation: Cache core app files
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// Activation: Clean up old caches immediately
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: Network first, fallback to offline cache
self.addEventListener("fetch", (event) => {
    // Ignore non-GET requests or requests to Firebase APIs
    if (
        event.request.method !== "GET" ||
        event.request.url.includes("firestore.googleapis.com") ||
        event.request.url.includes("identitytoolkit")
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache copy of fresh assets
                if (response && response.status === 200 && response.type === "basic") {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // If network request fails (offline), serve from cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (event.request.mode === "navigate") {
                        return caches.match("/");
                    }
                });
            })
    );
});