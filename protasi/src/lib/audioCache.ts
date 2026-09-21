import localforage from 'localforage'
import { levelAudio } from './loudness'

// IndexedDB store for audio blobs.
// We use IndexedDB (not CacheStorage) because iOS Safari caps CacheStorage at 50MB
// and doesn't support range-request slicing reliably. IndexedDB can hold up to ~20%
// of device disk space and blobs served as Object URLs bypass the SW entirely,
// avoiding the 206 Partial Content requirement for <audio> elements.
// Everything stored here has been levelled (see lib/loudness.ts), so every voice sounds equally
// loud. The store name changes whenever the levelling changes: audio saved under an older
// name is emptied once (never removed) and fetched again, processed the new way.
const store = localforage.createInstance({
  name: 'protasi',
  storeName: 'audioLeveled2',
  description: 'Levelled audio blobs for offline playback',
})

try {
  if (!localStorage.getItem('audioLeveledMigrated2')) {
    Promise.all(['audio', 'audioLeveled'].map(name =>
      localforage.createInstance({ name: 'protasi', storeName: name }).clear(),
    ))
      .then(() => localStorage.setItem('audioLeveledMigrated2', '1'))
      .catch(() => { /* try again next launch */ })
  }
} catch { /* storage unavailable — nothing to migrate */ }

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
    await store.setItem(url, await levelAudio(await response.blob()))
  } catch {
    /* CORS not configured or offline — will retry next time */
  }
}

// How much audio is stored on this device, for the Settings screen.
export async function getAudioCacheStats(): Promise<{ count: number; bytes: number }> {
  let count = 0
  let bytes = 0
  await store.iterate<Blob, void>(blob => {
    count++
    bytes += blob.size
  })
  return { count, bytes }
}

export async function clearAudioCache(): Promise<void> {
  await store.clear()
}
