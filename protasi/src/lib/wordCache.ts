import localforage from 'localforage'
import { translateGreekWordToEnglish, translateGreekBatch } from './api'

// IndexedDB store for per-word Greek→English translations.
// Text is tiny (tens of bytes per word), so this is essentially free storage-wise.
// Keeping it in IndexedDB (not just React state) means word taps work offline and
// persist across reloads.
const store = localforage.createInstance({
  name: 'protasi',
  storeName: 'words',
  description: 'Cached Greek→English word translations',
})

// Strip punctuation, lowercase — same normalisation used by the word-tap UI.
export function normalizeWord(word: string): string {
  return word.replace(/[^α-ωΑ-Ωά-ώΆ-Ώa-zA-Z]/g, '').toLowerCase()
}

export async function getCachedWord(word: string): Promise<string | null> {
  return store.getItem<string>(normalizeWord(word))
}

export async function setCachedWord(word: string, translation: string): Promise<void> {
  await store.setItem(normalizeWord(word), translation)
}

// Returns the translation for a word, using the cache or fetching+storing it.
export async function translateWordCached(word: string): Promise<string> {
  const clean = normalizeWord(word)
  const cached = await store.getItem<string>(clean)
  if (cached) return cached
  const translation = await translateGreekWordToEnglish(clean)
  await store.setItem(clean, translation)
  return translation
}

// Background pre-cache: translate every unique word in a Greek sentence and store it,
// so individual word taps are instant and work offline later. All uncached words go in a
// single request; a failure is ignored (they'll be fetched on tap, or next time).
export async function precacheWords(greekText: string): Promise<void> {
  if (!greekText) return
  const words = Array.from(
    new Set(greekText.split(/\s+/).map(normalizeWord).filter(w => w.length > 1))
  )
  try {
    const missing: string[] = []
    for (const w of words) if (!(await store.getItem<string>(w))) missing.push(w)
    if (!missing.length) return
    const translations = await translateGreekBatch(missing)
    for (let i = 0; i < missing.length; i++) {
      if (translations[i]) await store.setItem(missing[i], translations[i])
    }
  } catch {
    /* skip — will be retried next time the sentence is processed */
  }
}
