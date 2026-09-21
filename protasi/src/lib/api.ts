import { levelAudio } from './loudness'
// Calls our Vercel serverless proxy — API keys never leave the server.
// Every route requires a valid signed-in, invited user (see api/_lib/verifyAuth.ts).

import { auth } from './firebase'

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function translateToGreek(text: string): Promise<string> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`Translation failed: ${res.statusText}`)
  const data = await res.json()
  return data.translation as string
}

export async function translateGreekWordToEnglish(word: string): Promise<string> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ text: word, source: 'el', target: 'en' }),
  })
  if (!res.ok) throw new Error(`Translation failed: ${res.statusText}`)
  const data = await res.json()
  return data.translation as string
}

export async function generateSpeech(text: string, voiceId: string): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ text, voiceId }),
  })
  if (!res.ok) {
    // Surface the real reason (ElevenLabs status + message) in the console
    const detail = await res.text().catch(() => '')
    console.error('TTS failed:', res.status, detail)
    throw new Error(`TTS failed: ${res.status} ${detail}`)
  }
  // Quiet voices are lifted to a consistent level (see lib/loudness.ts)
  return levelAudio(await res.blob())
}

export async function listElevenLabsVoices(): Promise<{ voice_id: string; name: string }[]> {
  const res = await fetch('/api/voices', { headers: await authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.voices ?? []
}

export interface WordInfo {
  word: string
  gloss: string
  pos: string
  lemma?: string          // for verbs: the dictionary form, when known
  sentence?: string       // the Greek sentence the word was tapped in — practice avoids repeating it
}

export interface WordGrammar {
  pos: string
  lemma: string | null    // for verbs: the dictionary form
  gender: string | null   // masculine | feminine | neuter, when the word has one
  details: string         // e.g. "past · 1st person singular"
}

// Grammar of a word (part of speech, gender…) from a small Claude call. Google Translate
// supplies the meaning; it can't say what kind of word something is.
export async function getWordGrammar(word: string, context?: string): Promise<WordGrammar> {
  const res = await fetch('/api/word-info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ word, context }),
  })
  if (!res.ok) throw new Error('Could not look up word')
  return res.json()
}

export interface GeneratedSentence {
  greek: string
  english: string
  note: string
}

export async function generatePracticeSentences(params: {
  word: string; gloss: string; pos: string; count: number; level: string; tenses: string[]
  genders?: string[]; numbers?: string[]; avoid?: string
}): Promise<GeneratedSentence[]> {
  const res = await fetch('/api/generate-practice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Could not generate sentences')
  const data = await res.json()
  return data.sentences ?? []
}

export interface AccountSummary {
  uid: string
  email: string | undefined
  createdAt: string
}

export interface AccountLists {
  pending: AccountSummary[]
  active: AccountSummary[]
}

// Admin-only — see api/admin-pending.ts / api/admin-approve.ts. Rejected by the server
// for any account without the `admin` claim, regardless of what these return client-side.
export async function listAccounts(): Promise<AccountLists> {
  const res = await fetch('/api/admin-pending', { headers: await authHeaders() })
  if (!res.ok) throw new Error('Failed to load accounts')
  const data = await res.json()
  return { pending: data.pending ?? [], active: data.active ?? [] }
}

export async function updateAccount(uid: string, action: 'approve' | 'reject' | 'delete'): Promise<void> {
  const res = await fetch('/api/admin-approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ uid, action }),
  })
  if (!res.ok) throw new Error('Failed to update account')
}

// A verb's conjugation table from Claude, in the same shape as the built-in verb data
// (see src/lib/conjugation.ts). Slow, so callers cache the result.
export async function getConjugation(lemma: string): Promise<Record<string, unknown>> {
  const res = await fetch('/api/conjugation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ lemma }),
  })
  if (!res.ok) throw new Error('Could not build conjugation table')
  return res.json()
}
