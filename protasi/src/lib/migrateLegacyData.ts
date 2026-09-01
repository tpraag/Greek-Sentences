// One-time migration: copies this account's data from the app's original flat
// Firestore layout (collections/, sentences/, app/settings, app/progress) into the
// new users/{uid}/... layout, preserving every document's id. Safe to run more than
// once (setDoc overwrites with the same id rather than duplicating).
//
// Deliberately NOT wired into any permanent UI — invoked once during rollout (see the
// project's migration plan), then the trigger for this is removed again. Audio blobs
// are not moved: existing enAudioUrl/grAudioUrl download URLs carry their own access
// token and keep working wherever the file physically sits.

import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export interface MigrationResult {
  collections: number
  sentences: number
  settings: boolean
  progress: boolean
}

export async function migrateLegacyData(uid: string): Promise<MigrationResult> {
  const result: MigrationResult = { collections: 0, sentences: 0, settings: false, progress: false }

  const colSnap = await getDocs(collection(db, 'collections'))
  for (const d of colSnap.docs) {
    await setDoc(doc(db, 'users', uid, 'collections', d.id), d.data())
    result.collections++
  }

  const sentSnap = await getDocs(collection(db, 'sentences'))
  for (const d of sentSnap.docs) {
    await setDoc(doc(db, 'users', uid, 'sentences', d.id), d.data())
    result.sentences++
  }

  const settingsSnap = await getDocs(collection(db, 'app'))
  for (const d of settingsSnap.docs) {
    if (d.id !== 'settings' && d.id !== 'progress') continue
    await setDoc(doc(db, 'users', uid, 'app', d.id), d.data())
    if (d.id === 'settings') result.settings = true
    if (d.id === 'progress') result.progress = true
  }

  return result
}
