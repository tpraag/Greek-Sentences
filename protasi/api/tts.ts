import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireInvitedUser } from './_lib/verifyAuth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireInvitedUser(req))) return res.status(401).json({ error: 'Unauthorized' })

  const { text, voiceId } = req.body as { text: string; voiceId: string }
  if (!text || !voiceId) return res.status(400).json({ error: 'Missing text or voiceId' })

  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return res.status(500).json({ error: 'API key not configured' })

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    )

    if (!response.ok) {
      // Surface ElevenLabs' actual status + message so the real cause is visible
      const detail = await response.text()
      return res.status(502).json({
        error: 'TTS API error',
        status: response.status,
        detail: detail.slice(0, 500),
      })
    }

    const buffer = await response.arrayBuffer()
    res.setHeader('Content-Type', 'audio/mpeg')
    res.send(Buffer.from(buffer))
  } catch (e) {
    return res.status(502).json({ error: 'TTS request failed', detail: String(e).slice(0, 500) })
  }
}
