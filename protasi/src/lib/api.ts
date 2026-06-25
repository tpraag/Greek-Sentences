// Calls our Vercel serverless proxy — API keys never leave the server

export async function translateToGreek(text: string): Promise<string> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`Translation failed: ${res.statusText}`)
  const data = await res.json()
  return data.translation as string
}

export async function translateGreekWordToEnglish(word: string): Promise<string> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: word, source: 'el', target: 'en' }),
  })
  if (!res.ok) throw new Error(`Translation failed: ${res.statusText}`)
  const data = await res.json()
  return data.translation as string
}

export async function generateSpeech(text: string, voiceId: string): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId }),
  })
  if (!res.ok) throw new Error(`TTS failed: ${res.statusText}`)
  return res.blob()
}

export async function listElevenLabsVoices(): Promise<{ voice_id: string; name: string }[]> {
  const res = await fetch('/api/voices')
  if (!res.ok) return []
  const data = await res.json()
  return data.voices ?? []
}
