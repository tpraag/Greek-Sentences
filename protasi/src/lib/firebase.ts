import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged, type Auth } from 'firebase/auth'

const configured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID
)

let app: FirebaseApp | null = null
let _db: Firestore | null = null
let _storage: FirebaseStorage | null = null
let _auth: Auth | null = null

// Resolves once Firebase auth has determined the initial signed-in state (user or null).
// Storage/Firestore writes await this so the auth token is attached before the request.
let resolveReady: () => void
const authReady = new Promise<void>(res => { resolveReady = res })

if (configured) {
  app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  // Persistent cache — data survives refresh and works offline
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  })
  _storage = getStorage(app)
  _auth = getAuth(app)

  // Persist the session on the device so the user only signs in once per device.
  setPersistence(_auth, browserLocalPersistence).catch(() => {})

  // Resolve readiness once the initial auth state is known (signed in or not).
  const unsub = onAuthStateChanged(_auth, () => {
    resolveReady()
    unsub()
  })
} else {
  resolveReady!()
}

export const db = _db as Firestore
export const storage = _storage as FirebaseStorage
export const auth = _auth as Auth
export const isFirebaseConfigured = configured
export const firebaseAuthReady = authReady
