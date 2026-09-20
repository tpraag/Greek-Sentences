import localforage from 'localforage'
import { getWordGrammar, type WordGrammar } from './api'
import { normalizeWord } from './wordCache'

// IndexedDB store for per-word grammar (part of speech, gender…) from Claude — see
// api/word-info.ts. It's a paid LLM call per miss, so results are kept across sessions,
// and deliberately NOT pre-fetched in bulk like the plain word translations are (most
// words in a sentence never get tapped).
const store = localforage.createInstance({
  name: 'protasi',
  storeName: 'wordGrammar',
  description: 'Cached Greek word grammar (from Claude)',
})

export async function getWordGrammarCached(word: string, context?: string): Promise<WordGrammar> {
  const clean = normalizeWord(word)
  const cached = await store.getItem<WordGrammar>(clean)
  if (cached) return cached
  const grammar = await getWordGrammar(clean, context)
  await store.setItem(clean, grammar)
  return grammar
}
