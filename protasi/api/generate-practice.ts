import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireInvitedUser } from './_lib/verifyAuth.js'
import { askClaude } from './_lib/anthropic.js'

interface GeneratedSentence { greek: string; english: string; note: string; target?: string }

// Lowercase, no accents or punctuation — for spotting a generated sentence that is really
// the sentence the learner started from.
function normalise(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

function tooSimilar(a: string, b: string): boolean {
  const x = normalise(a)
  const y = normalise(b)
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true
  const xs = new Set(x.split(' '))
  const ys = new Set(y.split(' '))
  const shared = [...xs].filter(w => ys.has(w)).length
  return shared / (xs.size + ys.size - shared) >= 0.75
}

// Mirrors the design prototype's prompt shape almost verbatim (see the handoff README).
// Failures are handled client-side with a canned fallback set — this route just does
// its best and returns an error if it truly can't produce anything usable.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireInvitedUser(req))) return res.status(401).json({ error: 'Unauthorized' })

  const { word, gloss, pos, count, level, tenses, genders, numbers, avoid } = req.body as {
    word?: string; gloss?: string; pos?: string; count?: number; level?: string; tenses?: string[]
    genders?: string[]; numbers?: string[]; avoid?: string
  }
  if (!word || !gloss || !pos || !count || !level) {
    return res.status(400).json({ error: 'Missing word, gloss, pos, count, or level' })
  }

  let variationLine: string
  if (pos === 'verb') {
    variationLine = `Vary the conjugation across these tenses/moods: ${(tenses ?? []).join(', ') || 'Present'}. Use different persons (εγώ, εσύ, εμείς...).`
  } else if (pos === 'adjective') {
    const g = genders?.length ? genders.join(', ') : 'masculine, feminine, neuter'
    const n = numbers?.length ? numbers.join(', ') : 'singular, plural'
    variationLine = `This is an adjective, so show it agreeing with different nouns in these genders: ${g}; and these numbers: ${n}. Vary the combinations across the set (and the case where natural). The note must name the form used, e.g. "feminine · plural".`
  } else {
    variationLine = 'Vary the grammatical case and number where natural.'
  }

  // Ask for a couple extra when there's a sentence to avoid, so filtering it out still
  // leaves the number the learner asked for.
  const wanted = avoid ? count + 2 : count
  const avoidLine = avoid
    ? `\nThe learner just met this word in the sentence "${avoid}". Do NOT reuse that sentence or anything close to it — write completely different sentences in different situations.`
    : ''

  const prompt = `You are a Modern Greek tutor. Write ${wanted} natural Modern Greek practice sentences that all use the word "${word}" (meaning: ${gloss}, ${pos}), at CEFR level ${level}. ${variationLine}${avoidLine}
Return ONLY a JSON array, no prose, no markdown fence. Each element: {"greek": "...", "english": "...", "note": "short grammar label, max 4 words, e.g. '2nd person · past'", "target": "the single word exactly as it appears in the Greek sentence (the inflected form of the practice word, without θα/να or punctuation)"}.`

  try {
    const raw = await askClaude(prompt, 2200)
    const match = raw.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(match ? match[0] : raw) as GeneratedSentence[]
    if (!Array.isArray(parsed) || !parsed.length) throw new Error('bad shape')
    const fresh = avoid ? parsed.filter(s => typeof s?.greek === 'string' && !tooSimilar(s.greek, avoid)) : parsed
    if (!fresh.length) throw new Error('every sentence was too close to the source sentence')
    res.json({ sentences: fresh.slice(0, count) })
  } catch (e) {
    console.error('generate-practice failed:', e)
    res.status(502).json({ error: 'Could not generate sentences' })
  }
}
