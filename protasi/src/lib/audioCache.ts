import localforage from 'localforage'

// IndexedDB store for audio blobs.
// We use IndexedDB (not CacheStorage) because iOS Safari caps CacheStorage at 50MB
// and doesn't support range-request slicing reliably. IndexedDB can hold up to ~20%
// of device disk space and blobs served as Object URLs bypass the SW entirely,
// avoiding the 206 Partial Content requirement for <audio> elements.
const store = localforage.createInstance({
  name: 'protasi',
  storeName: 'audio',
  description: 'Audio blobs for offline playback',
})

export async function cacheAudioBlob(url: string, blob: Blob): Promise<void> {
  await store.setItem(url, blob)
}

// Returns an Object URL if the audio is already cached in IndexedDB, otherwise null.
// Fast and local — never hits the network, so it's safe to await before playback.
export async function getCachedObjectUrl(url: string): Promise<string | null> {
  const cached = await store.getItem<Blob>(url)
  return cached ? URL.createObjectURL(cached) : null
}

// Fetches the audio over the network and stores it in IndexedDB for offline use.
// Requires CORS to be enabled on the Storage bucket; fails silently otherwise.
// Used as a background "warm the cache" call — playback never waits on it.
export async function fetchAndCache(url: string): Promise<void> {
  try {
    if (await store.getItem<Blob>(url)) return // already cached
    const response = await fetch(url)
    if (!response.ok) return
    await store.setItem(url, await response.blob())
  } catch {
    /* CORS not configured or offline — will retry next time */
  }
}
