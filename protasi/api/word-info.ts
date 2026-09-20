import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireInvitedUser } from './_lib/verifyAuth.js'
import { askClaude } from './_lib/anthropic.js'

// Returns {gloss, pos} for a single Greek word — Google Translate (used elsewhere in
// the app for quick word lookups) has no notion of part of speech, which the Word
// Practice flow needs to decide whether to show the verb-tense picker.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireInvitedUser(req))) return res.status(401).json({ error: 'Unauthorized' })

  const { word, context } = req.body as { word?: string; context?: string }
  if (!word) return res.status(400).json({ error: 'Missing word' })

  const prompt = `You are a Modern Greek dictionary. For the Greek word "${word}"${context ? ` as used in the sentence "${context}"` : ''}, give its dictionary (lemma) meaning in this exact sentence context.
Return ONLY a JSON object, no prose, no markdown fence: {"gloss": "short English meaning, 1-4 words", "pos": "one of: verb, noun, adjective, adverb, pronoun, preposition, conjunction, other"}.`

  try {
    const raw = await askClaude(prompt, 200)
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : raw)
    if (!parsed?.gloss || !parsed?.pos) throw new Error('bad shape')
    res.json({ word, gloss: String(parsed.gloss), pos: String(parsed.pos) })
  } catch (e) {
    console.error('word-info failed:', e)
    res.status(502).json({ error: 'Could not look up word' })
  }
}
