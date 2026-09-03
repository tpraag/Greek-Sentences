import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth } from './_lib/firebaseAdmin.js'
import { requireAdmin } from './_lib/verifyAuth.js'

// Lists accounts that signed up (carry `invited`) but haven't been approved yet.
// Gated by the caller's own `admin` claim, not a shared secret — this is meant to be
// called from the app itself while signed in as the admin account.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  if (!(await requireAdmin(req))) return res.status(401).json({ error: 'Unauthorized' })

  const pending: { uid: string; email: string | undefined; createdAt: string }[] = []
  let pageToken: string | undefined
  do {
    const page = await adminAuth().listUsers(1000, pageToken)
    for (const u of page.users) {
      const claims = u.customClaims ?? {}
      if (claims.invited === true && claims.approved !== true) {
        pending.push({ uid: u.uid, email: u.email, createdAt: u.metadata.creationTime })
      }
    }
    pageToken = page.pageToken
  } while (pageToken)

  res.json({ pending })
}
