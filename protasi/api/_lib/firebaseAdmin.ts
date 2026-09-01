import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

// Reused across every api/*.ts route that needs the Admin SDK — Vercel can reuse the
// same warm lambda instance across invocations, so guard against re-initializing.
export function getAdminApp(): App {
  const existing = getApps()
  if (existing.length) return existing[0]!
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Vercel env vars can't hold a literal multi-line value cleanly — stored with
      // escaped \n sequences that need converting back to real newlines.
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export function adminAuth() {
  return getAuth(getAdminApp())
}
