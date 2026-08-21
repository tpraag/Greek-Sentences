/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()

// Injected by vite-plugin-pwa at build time — pre-caches all app shell assets (HTML, JS, CSS, icons)
// Audio files are handled entirely in the app layer via IndexedDB (localforage) and Object URLs,
// bypassing the service worker to avoid iOS Safari's 206 Partial Content requirement for <audio>.
precacheAndRoute(self.__WB_MANIFEST)
