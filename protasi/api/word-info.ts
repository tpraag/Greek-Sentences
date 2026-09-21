import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireInvitedUser } from './_lib/verifyAuth.js'
import { askClaude } from './_lib/anthropic.js'

const POS = ['verb', 'noun', 'adjective', 'adverb', 'pronoun', 'article', 'preposition', 'conjunction', 'numeral', 'particle', 'other']
const GENDERS = ['masculine', 'feminine', 'neuter']

// Returns the grammar of a single Greek word — part of speech, the verb's dictionary form,
// gender, and a short description of the exact form. The English meaning comes from Google Translate on the
// client (much faster); Google can't say what kind of word something is, which is what
// this is for. The output is deliberately tiny so the call stays quick.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireInvitedUser(req))) return res.status(401).json({ error: 'Unauthorized' })

  const { word, context } = req.body as { word?: string; context?: string }
  if (!word) return res.status(400).json({ error: 'Missing word' })

  const prompt = `Analyse the Modern Greek word "${word}"${context ? ` as used in the sentence "${context}"` : ''}.
Return ONLY a JSON object, no prose, no markdown fence:
{"pos": one of ${POS.join(', ')}, "lemma": for a verb, its dictionary form (1st person singular present, e.g. "μιλάω"; for passive-only verbs the -ομαι form), otherwise null, "gender": "masculine", "feminine" or "neuter" for nouns, adjectives, articles and pronouns that have one, otherwise null, "details": very short grammar of this exact form such as "past · 1st person singular" or "accusative plural", or "" if nothing useful}`

  try {
    const raw = await askClaude(prompt, 150)
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : raw)
    const pos = POS.includes(parsed?.pos) ? parsed.pos : 'other'
    const gender = GENDERS.includes(parsed?.gender) ? parsed.gender : null
    const details = typeof parsed?.details === 'string' ? parsed.details.slice(0, 60) : ''
    const lemma = pos === 'verb' && typeof parsed?.lemma === 'string' && parsed.lemma.trim() ? parsed.lemma.trim().toLowerCase() : null
    res.json({ pos, lemma, gender, details })
  } catch (e) {
    console.error('word-info failed:', e)
    res.status(502).json({ error: 'Could not look up word' })
  }
}
