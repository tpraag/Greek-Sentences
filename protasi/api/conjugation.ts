import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireInvitedUser } from './_lib/verifyAuth.js'
import { askClaude } from './_lib/anthropic.js'
import { getFirestore } from 'firebase-admin/firestore'
import { getAdminApp } from './_lib/firebaseAdmin.js'

// Conjugation tables for verbs that aren't in the app's built-in verb data. Accuracy
// matters more than speed here (learners will study these forms), so this uses the
// stronger model. Each table is written once to a shared `verbTables` collection and served
// from there afterwards — for every account and device — so Claude is asked once per verb.
// That collection sits outside users/{uid}, which the Firestore rules deny to clients, so
// it can only be read or written through this route (Admin SDK). To fix a wrong table,
// delete its document in the Firebase console; the next request rebuilds it.
const MODEL = 'claude-sonnet-5'

// A table can take several seconds; give the function room beyond the default
export const config = { maxDuration: 30 }

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

  const prompt = `Give the complete Modern Greek conjugation of the verb "${lemma.trim()}", in standard modern spelling.
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

  // Tables are stored permanently and shared, so only accept something that looks like a
  // Greek word — nothing else should be able to create an entry (or a document id).
  const key = lemma.trim().toLowerCase()
  if (!/^[α-ωάέήίόύώϊϋΐΰ]{2,30}$/.test(key)) return res.status(400).json({ error: 'Invalid lemma' })

  const store = () => getFirestore(getAdminApp()).collection('verbTables').doc(key)

  try {
    const saved = await store().get()
    if (saved.exists && saved.data()?.entry) return res.json(saved.data()!.entry)
  } catch (e) {
    console.error('verbTables read failed (falling back to Claude):', e)
  }

  try {
    const raw = await askClaude(prompt, 2500, MODEL, { noThinking: true })
    const match = raw.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : raw)

    const entry: Record<string, unknown> = { m: typeof parsed?.meaning === 'string' ? parsed.meaning.trim().slice(0, 80) : '' }
    for (const [claudeKey, key] of Object.entries(SECTIONS)) {
      const row = cleanRow(parsed?.[claudeKey])
      if (row) entry[key] = row
    }
    // A table without at least a present and a past isn't worth showing
    if (!entry.pr || !entry.pa) throw new Error('incomplete table')

    // Keep it for next time — a failed write shouldn't lose the table we just built
    await store().set({ entry, model: MODEL, createdAt: Date.now() }).catch(e => console.error('verbTables write failed:', e))
    res.json(entry)
  } catch (e) {
    console.error('conjugation failed:', e)
    res.status(502).json({ error: 'Could not build conjugation table' })
  }
}
