import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getFirestore } from 'firebase-admin/firestore'
import { adminAuth, getAdminApp } from './_lib/firebaseAdmin'

// Mirrors DEFAULT_SETTINGS / DEFAULT_PROGRESS in src/store/index.tsx — kept in sync
// manually since this runs server-side and can't import client store code.
const DEFAULT_SETTINGS = {
  enVoiceId: '',
  grVoiceId: '',
  order: 'en-gr',
  gapSeconds: 3,
  greekSpeed: 1.0,
  sentenceRepeat: 1,
  defaultPlayerView: 'compact',
  autoTranslate: true,
  autoNarrate: true,
  showPhonetics: true,
}
const DEFAULT_PROGRESS = { lifetimeMasteryPoints: 0 }

// Account creation happens here, server-side, rather than via the client Firebase SDK
// directly — that's what makes the invite code an actual gate rather than just a UI
// suggestion. Also sets the `invited` custom claim that every security rule and every
// other paid API route checks before allowing anything.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password, inviteCode } = req.body as { email?: string; password?: string; inviteCode?: string }
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  if (!process.env.INVITE_CODE || inviteCode !== process.env.INVITE_CODE) {
    return res.status(403).json({ error: 'Invalid invite code' })
  }

  try {
    const user = await adminAuth().createUser({ email, password })
    await adminAuth().setCustomUserClaims(user.uid, { invited: true })

    const db = getFirestore(getAdminApp())
    await db.doc(`users/${user.uid}/app/settings`).set(DEFAULT_SETTINGS)
    await db.doc(`users/${user.uid}/app/progress`).set(DEFAULT_PROGRESS)

    res.json({ ok: true })
  } catch (e) {
    const code = (e as { errorInfo?: { code?: string }; code?: string })?.errorInfo?.code
      ?? (e as { code?: string })?.code
    if (code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'An account with that email already exists' })
    }
    if (code === 'auth/invalid-password') {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }
    console.error('signup failed:', e)
    return res.status(500).json({ error: 'Sign up failed' })
  }
}
