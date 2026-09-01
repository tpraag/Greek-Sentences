import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth } from './_lib/firebaseAdmin.js'

// Internal one-off tool, not linked from any UI — sets the `invited` claim on an
// existing account. Needed once during rollout to retrofit the pre-existing account
// that predates this claim; kept around afterward in case it's ever needed again.
// Gated by ADMIN_SECRET (set in Vercel env), not the sign-up INVITE_CODE.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { secret, uid, email } = req.body as { secret?: string; uid?: string; email?: string }
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!uid && !email) return res.status(400).json({ error: 'Provide uid or email' })

  try {
    const user = uid ? await adminAuth().getUser(uid) : await adminAuth().getUserByEmail(email!)
    await adminAuth().setCustomUserClaims(user.uid, { ...user.customClaims, invited: true })
    res.json({ ok: true, uid: user.uid, email: user.email })
  } catch (e) {
    console.error('admin-grant failed:', e)
    res.status(500).json({ error: 'Failed to grant claim' })
  }
}
