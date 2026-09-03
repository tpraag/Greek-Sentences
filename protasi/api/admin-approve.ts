import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth } from './_lib/firebaseAdmin.js'
import { requireAdmin } from './_lib/verifyAuth.js'
import { deleteUserData } from './_lib/deleteUserData.js'

// Approves, rejects, or deletes an account. Gated by the caller's own `admin` claim.
// 'reject' and 'delete' are the same underlying operation (full removal) — kept as
// separate action names for clarity at the call site (rejecting a pending sign-up vs.
// deleting an already-active account with real content).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireAdmin(req))) return res.status(401).json({ error: 'Unauthorized' })

  const { uid, action } = req.body as { uid?: string; action?: 'approve' | 'reject' | 'delete' }
  if (!uid || !['approve', 'reject', 'delete'].includes(action ?? '')) {
    return res.status(400).json({ error: 'Provide uid and action ("approve", "reject", or "delete")' })
  }

  try {
    if (action === 'approve') {
      const user = await adminAuth().getUser(uid)
      await adminAuth().setCustomUserClaims(uid, { ...user.customClaims, approved: true })
    } else {
      await deleteUserData(uid)
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('admin-approve failed:', e)
    res.status(500).json({ error: 'Failed to update account' })
  }
}
