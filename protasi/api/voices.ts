import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireInvitedUser } from './_lib/verifyAuth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  if (!(await requireInvitedUser(req))) return res.status(401).json({ error: 'Unauthorized' })

  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': key },
  })

  if (!response.ok) return res.status(502).json({ error: 'ElevenLabs API error' })

  const data = await response.json()
  res.json({ voices: data.voices ?? [] })
}
