import type { VercelRequest, VercelResponse } from '@vercel/node'
import { adminAuth } from './_lib/firebaseAdmin.js'
import { requireAdmin } from './_lib/verifyAuth.js'

interface UserSummary { uid: string; email: string | undefined; createdAt: string }

// Lists every account that signed up through our flow (carries `invited`), split into
// those still waiting on approval and those already active. Gated by the caller's own
// `admin` claim, not a shared secret — meant to be called from the app itself while
// signed in as the admin account.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  if (!(await requireAdmin(req))) return res.status(401).json({ error: 'Unauthorized' })

  const pending: UserSummary[] = []
  const active: UserSummary[] = []
  let pageToken: string | undefined
  do {
    const page = await adminAuth().listUsers(1000, pageToken)
    for (const u of page.users) {
      const claims = u.customClaims ?? {}
      if (claims.invited !== true) continue // never went through our sign-up flow
      const summary = { uid: u.uid, email: u.email, createdAt: u.metadata.creationTime }
      if (claims.approved === true) active.push(summary)
      else pending.push(summary)
    }
    pageToken = page.pageToken
  } while (pageToken)

  res.json({ pending, active })
}
