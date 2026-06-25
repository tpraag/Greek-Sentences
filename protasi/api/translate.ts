import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { text, source = 'en', target = 'el' } = req.body as { text: string; source?: string; target?: string }
  if (!text) return res.status(400).json({ error: 'Missing text' })

  const key = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source, target, format: 'text' }),
    }
  )

  if (!response.ok) {
    return res.status(502).json({ error: 'Translation API error' })
  }

  const data = await response.json()
  const translation = data?.data?.translations?.[0]?.translatedText ?? ''
  res.json({ translation })
}
