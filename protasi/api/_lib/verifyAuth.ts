import type { VercelRequest } from '@vercel/node'
import { adminAuth } from './firebaseAdmin.js'

// Verifies the caller sent a valid Firebase ID token for an account that was
// actually provisioned through our sign-up flow (carries the `invited` claim).
// Returns the uid on success, or null — every paid API route should refuse to
// proceed on null rather than silently running unauthenticated.
export async function requireInvitedUser(req: VercelRequest): Promise<string | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length)
  try {
    const decoded = await adminAuth().verifyIdToken(token)
    return decoded.invited === true ? decoded.uid : null
  } catch {
    return null
  }
}
