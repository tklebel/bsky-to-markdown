// Minimal service worker — required for PWA installability (and therefore
// Web Share Target registration). The app is online-only so no caching needed.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
