import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireInvitedUser } from './_lib/verifyAuth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireInvitedUser(req))) return res.status(401).json({ error: 'Unauthorized' })

  const { text, source = 'en', target = 'el' } = req.body as { text: string; source?: string; target?: string }
  if (!text) return res.status(400).json({ error: 'Missing text' })

  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  let response: Response
  try {
    response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source, target, format: 'text' }),
      }
    )
  } catch (err) {
    console.error('Translate fetch failed:', err)
    return res.status(502).json({ error: 'Could not reach Google Translate' })
  }

  if (!response.ok) {
    // Surface Google's own reason (bad/expired key, billing off, quota, referrer/API restriction…)
    const body = await response.json().catch(() => null)
    const reason = body?.error?.message ?? response.statusText
    console.error('Google Translate error:', response.status, JSON.stringify(body?.error ?? body))
    return res.status(502).json({ error: `Google Translate ${response.status}: ${reason}` })
  }

  const data = await response.json()
  const translation = data?.data?.translations?.[0]?.translatedText ?? ''
  res.json({ translation })
}
