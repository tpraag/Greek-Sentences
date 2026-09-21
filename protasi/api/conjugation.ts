import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireInvitedUser } from './_lib/verifyAuth.js'
import { askClaude } from './_lib/anthropic.js'

// Conjugation tables for verbs that aren't in the app's built-in verb data. Accuracy
// matters more than speed here (learners will study these forms), so this uses the
// stronger model; the client keeps the result on the device so each verb is asked once.
const MODEL = 'claude-sonnet-5'

// JSON key from Claude → key used by the app's built-in verb data (see src/lib/conjugation.ts)
const SECTIONS: Record<string, string> = {
  present: 'pr',
  aorist: 'pa',
  imperfect: 'im',
  future: 'fu',
  futureContinuous: 'fc',
  perfect: 'pf',
  imperativeSimple: 'is',
  imperativeContinuous: 'ic',
}

function cleanRow(value: unknown): (string | null)[] | null {
  if (!Array.isArray(value)) return null
  const row = Array.from({ length: 6 }, (_, i) => {
    const v = value[i]
    return typeof v === 'string' && v.trim() && v.trim() !== '—' ? v.trim() : null
  })
  return row.some(Boolean) ? row : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireInvitedUser(req))) return res.status(401).json({ error: 'Unauthorized' })

  const { lemma } = req.body as { lemma?: string }
  if (!lemma || lemma.length > 40) return res.status(400).json({ error: 'Missing or invalid lemma' })

  const prompt = `Give the complete Modern Greek conjugation of the verb "${lemma}", in standard modern spelling.
Every list has six entries in this person order: εγώ, εσύ, αυτός/ή/ό, εμείς, εσείς, αυτοί/ές/ά. Use null for a person that doesn't exist or a form that doesn't exist. Use the ordinary active forms (or the passive/deponent forms if the verb only exists that way).
Return ONLY a JSON object, no prose, no markdown fence:
{"meaning": "short English meaning, e.g. \\"to speak, to talk\\"",
 "present": [...],
 "aorist": [simple past, e.g. "μίλησα"...],
 "imperfect": [continuous past, e.g. "μιλούσα"...],
 "future": [simple future with θα, e.g. "θα μιλήσω"...],
 "futureContinuous": [continuous future with θα, e.g. "θα μιλάω"...],
 "perfect": [present perfect, e.g. "έχω μιλήσει"...],
 "imperativeSimple": [null, "εσύ form", null, null, "εσείς form", null],
 "imperativeContinuous": [null, "εσύ form", null, null, "εσείς form", null]}`

  try {
    const raw = await askClaude(prompt, 1500, MODEL)
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : raw)

    const entry: Record<string, unknown> = { m: typeof parsed?.meaning === 'string' ? parsed.meaning.trim().slice(0, 80) : '' }
    for (const [claudeKey, key] of Object.entries(SECTIONS)) {
      const row = cleanRow(parsed?.[claudeKey])
      if (row) entry[key] = row
    }
    // A table without at least a present and a past isn't worth showing
    if (!entry.pr || !entry.pa) throw new Error('incomplete table')
    res.json(entry)
  } catch (e) {
    console.error('conjugation failed:', e)
    res.status(502).json({ error: 'Could not build conjugation table' })
  }
}
