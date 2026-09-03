import type { VercelRequest } from '@vercel/node'
import { adminAuth } from './firebaseAdmin.js'

async function decodeBearer(req: VercelRequest) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length)
  try {
    return await adminAuth().verifyIdToken(token)
  } catch {
    return null
  }
}

// Verifies the caller sent a valid Firebase ID token for an account that was both
// provisioned through our sign-up flow (`invited`) and manually approved by an admin
// (`approved`) — a sign-up alone doesn't grant access. Returns the uid on success, or
// null — every paid API route should refuse to proceed on null rather than silently
// running unauthenticated.
export async function requireInvitedUser(req: VercelRequest): Promise<string | null> {
  const decoded = await decodeBearer(req)
  if (!decoded) return null
  return decoded.invited === true && decoded.approved === true ? decoded.uid : null
}

// Verifies the caller carries the `admin` claim — set manually, once, only on the
// project owner's own account (see api/admin-grant.ts). Gates the pending-signups
// approval endpoints.
export async function requireAdmin(req: VercelRequest): Promise<string | null> {
  const decoded = await decodeBearer(req)
  if (!decoded) return null
  return decoded.admin === true ? decoded.uid : null
}
