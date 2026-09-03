import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getAdminApp, adminAuth } from './firebaseAdmin.js'

// Fully removes an account: the Firebase Auth user, every Firestore document under
// users/{uid}/... (collections, sentences, app/settings, app/progress), and every
// Storage file under users/{uid}/audio/. Used both for rejecting a pending sign-up
// (which has at most the two placeholder docs signup.ts seeds) and for deleting an
// already-active account (which may have real content) — same operation either way,
// just a bigger cleanup in the latter case. Irreversible.
export async function deleteUserData(uid: string): Promise<void> {
  const app = getAdminApp()
  const db = getFirestore(app)

  const colSnap = await db.collection(`users/${uid}/collections`).get()
  await Promise.all(colSnap.docs.map(d => d.ref.delete()))

  const sentSnap = await db.collection(`users/${uid}/sentences`).get()
  await Promise.all(sentSnap.docs.map(d => d.ref.delete()))

  await db.doc(`users/${uid}/app/settings`).delete()
  await db.doc(`users/${uid}/app/progress`).delete()

  try {
    const bucket = getStorage(app).bucket('protasi-eu.firebasestorage.app')
    const [files] = await bucket.getFiles({ prefix: `users/${uid}/audio/` })
    await Promise.all(files.map(f => f.delete().catch(() => {})))
  } catch (e) {
    console.error('deleteUserData: storage cleanup failed:', e)
  }

  await adminAuth().deleteUser(uid)
}
