import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireInvitedUser } from './_lib/verifyAuth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const uid = await requireInvitedUser(req)
  if (!uid) return res.status(401).json({ error: 'Unauthorized' })

  const { text, texts, source = 'en', target = 'el' } = req.body as { text?: string; texts?: string[]; source?: string; target?: string }
  // One request can carry a whole batch (e.g. every word of a sentence) — far fewer calls
  // against Google's per-user rate limit than one call per word.
  const q = Array.isArray(texts) ? texts.filter(t => typeof t === 'string' && t) : text ? [text] : []
  if (!q.length) return res.status(400).json({ error: 'Missing text' })

  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  // quotaUser makes Google count the rate limit per signed-in user rather than per (shared)
  // Vercel server address. A rate-limit reply is retried a couple of times with a short wait.
  const url = `https://translation.googleapis.com/language/translate/v2?key=${key}&quotaUser=${encodeURIComponent(uid)}`
  let response: Response | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, source, target, format: 'text' }),
      })
    } catch (err) {
      console.error('Translate fetch failed:', err)
      return res.status(502).json({ error: 'Could not reach Google Translate' })
    }
    if (response.ok || (response.status !== 403 && response.status !== 429)) break
    if (attempt < 2) await new Promise(r => setTimeout(r, 1200 * (attempt + 1)))
  }

  if (!response || !response.ok) {
    // Surface Google's own reason (bad/expired key, billing off, quota, referrer/API restriction…)
    const body = await response?.json().catch(() => null)
    const reason = body?.error?.message ?? response?.statusText
    console.error('Google Translate error:', response?.status, JSON.stringify(body?.error ?? body))
    return res.status(502).json({ error: `Google Translate ${response?.status}: ${reason}` })
  }

  const data = await response.json()
  const translations: string[] = (data?.data?.translations ?? []).map((t: { translatedText?: string }) => t.translatedText ?? '')
  res.json(Array.isArray(texts) ? { translations } : { translation: translations[0] ?? '' })
}
