import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getFirestore } from 'firebase-admin/firestore'
import { adminAuth, getAdminApp } from './_lib/firebaseAdmin.js'
import { requireAdmin } from './_lib/verifyAuth.js'

// Approves or rejects a pending sign-up. Gated by the caller's own `admin` claim.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!(await requireAdmin(req))) return res.status(401).json({ error: 'Unauthorized' })

  const { uid, action } = req.body as { uid?: string; action?: 'approve' | 'reject' }
  if (!uid || (action !== 'approve' && action !== 'reject')) {
    return res.status(400).json({ error: 'Provide uid and action ("approve" or "reject")' })
  }

  try {
    if (action === 'approve') {
      const user = await adminAuth().getUser(uid)
      await adminAuth().setCustomUserClaims(uid, { ...user.customClaims, approved: true })
    } else {
      // Reject — remove the account and the two placeholder docs signup.ts seeded for it.
      await adminAuth().deleteUser(uid)
      const db = getFirestore(getAdminApp())
      await db.doc(`users/${uid}/app/settings`).delete()
      await db.doc(`users/${uid}/app/progress`).delete()
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('admin-approve failed:', e)
    res.status(500).json({ error: 'Failed to update account' })
  }
}
