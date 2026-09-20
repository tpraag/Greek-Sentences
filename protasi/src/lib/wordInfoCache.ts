import localforage from 'localforage'
import { getWordInfo, type WordInfo } from './api'
import { normalizeWord } from './wordCache'

// IndexedDB store for per-word {gloss, pos} lookups from Claude (see api/word-info.ts).
// Unlike the free-ish Google Translate word cache, this is a paid LLM call per miss —
// worth persisting across sessions, and deliberately NOT pre-fetched in bulk the way
// precacheWords() does for plain translations (most words in a sentence never get
// tapped, so eagerly asking Claude about every one would be wasteful).
const store = localforage.createInstance({
  name: 'protasi',
  storeName: 'wordInfo',
  description: 'Cached Greek word gloss + part of speech (from Claude)',
})

export async function getWordInfoCached(word: string, context?: string): Promise<WordInfo> {
  const clean = normalizeWord(word)
  const cached = await store.getItem<WordInfo>(clean)
  if (cached) return cached
  const info = await getWordInfo(clean, context)
  await store.setItem(clean, info)
  return info
}
