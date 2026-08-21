import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

// The single account this app signs in as. Baked in so the login screen only asks
// for a password (email isn't a secret — the security rules lock data to this account).
export const APP_EMAIL = 'timor.praag@gmail.com'

export function subscribeAuth(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb)
}

export async function signInWithPassword(password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, APP_EMAIL, password)
}

export async function signOutUser(): Promise<void> {
  await signOut(auth)
}
