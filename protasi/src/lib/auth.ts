import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  getIdTokenResult,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

export function subscribeAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password)
}

// Account creation happens server-side (api/signup.ts), gated by an invite code —
// the client SDK's own createUserWithEmailAndPassword is deliberately not used here,
// since that would let anyone with the public Firebase config self-register.
export async function signUp(email: string, password: string, inviteCode: string): Promise<void> {
  const res = await fetch('/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, inviteCode }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Sign up failed')
  }
  await signInWithEmailAndPassword(auth, email, password)
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}

export interface UserClaims {
  invited: boolean
  approved: boolean
  admin: boolean
}

// forceRefresh bypasses the cached ID token — needed after an admin approves someone,
// since the claim change won't otherwise show up client-side for up to an hour.
export async function getUserClaims(user: User, forceRefresh = false): Promise<UserClaims> {
  const result = await getIdTokenResult(user, forceRefresh)
  return {
    invited: result.claims.invited === true,
    approved: result.claims.approved === true,
    admin: result.claims.admin === true,
  }
}
