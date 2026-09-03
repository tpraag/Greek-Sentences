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
  return res.blob()
}

export async function listElevenLabsVoices(): Promise<{ voice_id: string; name: string }[]> {
  const res = await fetch('/api/voices', { headers: await authHeaders() })
  if (!res.ok) return []
  const data = await res.json()
  return data.voices ?? []
}

export interface PendingSignup {
  uid: string
  email: string | undefined
  createdAt: string
}

// Admin-only — see api/admin-pending.ts / api/admin-approve.ts. Rejected by the server
// for any account without the `admin` claim, regardless of what these return client-side.
export async function listPendingSignups(): Promise<PendingSignup[]> {
  const res = await fetch('/api/admin-pending', { headers: await authHeaders() })
  if (!res.ok) throw new Error('Failed to load pending sign-ups')
  const data = await res.json()
  return data.pending ?? []
}

export async function approveSignup(uid: string, action: 'approve' | 'reject'): Promise<void> {
  const res = await fetch('/api/admin-approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ uid, action }),
  })
  if (!res.ok) throw new Error('Failed to update sign-up')
}
