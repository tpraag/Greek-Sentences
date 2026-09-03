import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth } from './_lib/firebaseAdmin.js'

// Internal one-off tool, not linked from any UI — merges arbitrary custom claims onto
// an existing account. Used during rollout to retrofit `invited`/`approved` onto the
// pre-existing account, and to set the `admin` claim (once, on the project owner's own
// account — that claim is otherwise never granted anywhere else in the app).
// Gated by ADMIN_SECRET (set in Vercel env), not the sign-up INVITE_CODE.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { secret, uid, email, claims } = req.body as {
    secret?: string; uid?: string; email?: string; claims?: Record<string, unknown>
  }
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!uid && !email) return res.status(400).json({ error: 'Provide uid or email' })

  try {
    const user = uid ? await adminAuth().getUser(uid) : await adminAuth().getUserByEmail(email!)
    const merged = { ...user.customClaims, ...(claims ?? { invited: true }) }
    await adminAuth().setCustomUserClaims(user.uid, merged)
    res.json({ ok: true, uid: user.uid, email: user.email, claims: merged })
  } catch (e) {
    console.error('admin-grant failed:', e)
    res.status(500).json({ error: 'Failed to grant claim' })
  }
}
