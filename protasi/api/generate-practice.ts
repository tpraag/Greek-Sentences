import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireInvitedUser } from './_lib/verifyAuth.js'
import { askClaude } from './_lib/anthropic.js'

interface GeneratedSentence { greek: string; english: string; note: string }

// Mirrors the design prototype's prompt shape almost verbatim (see the handoff README).
// Failures are handled client-side with a canned fallback set — this route just does
// its best and returns an error if it truly can't produce anything usable.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireInvitedUser(req))) return res.status(401).json({ error: 'Unauthorized' })

  const { word, gloss, pos, count, level, tenses } = req.body as {
    word?: string; gloss?: string; pos?: string; count?: number; level?: string; tenses?: string[]
  }
  if (!word || !gloss || !pos || !count || !level) {
    return res.status(400).json({ error: 'Missing word, gloss, pos, count, or level' })
  }

  const variationLine = pos === 'verb'
    ? `Vary the conjugation across these tenses/moods: ${(tenses ?? []).join(', ') || 'Present'}. Use different persons (εγώ, εσύ, εμείς...).`
    : 'Vary the grammatical case and number where natural.'

  const prompt = `You are a Modern Greek tutor. Write ${count} natural Modern Greek practice sentences that all use the word "${word}" (meaning: ${gloss}, ${pos}), at CEFR level ${level}. ${variationLine}
Return ONLY a JSON array, no prose, no markdown fence. Each element: {"greek": "...", "english": "...", "note": "short grammar label, max 4 words, e.g. '2nd person · past'"}.`

  try {
    const raw = await askClaude(prompt, 1600)
    const match = raw.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(match ? match[0] : raw) as GeneratedSentence[]
    if (!Array.isArray(parsed) || !parsed.length) throw new Error('bad shape')
    res.json({ sentences: parsed.slice(0, count) })
  } catch (e) {
    console.error('generate-practice failed:', e)
    res.status(502).json({ error: 'Could not generate sentences' })
  }
}
